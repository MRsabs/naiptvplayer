//! Minimalistic libVLC media-player window (Windows only).
//!
//! Loads libvlc.dll at runtime from the embedded resources, creates a plain
//! Win32 window, embeds the VLC video output into it, and runs a message loop
//! — all on a dedicated background thread so Tauri is never blocked.

#![cfg(windows)]

use std::ffi::{c_char, c_void, CString};
use std::path::{Path, PathBuf};

use libloading::Library;
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    System::LibraryLoader::GetModuleHandleW,
    UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
        GetWindowLongPtrW, LoadCursorW, PostQuitMessage, RegisterClassExW, SetWindowLongPtrW,
        ShowWindow, TranslateMessage, CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT, GWLP_USERDATA,
        IDC_ARROW, MSG, SW_SHOW, WM_CLOSE, WM_DESTROY, WM_ERASEBKGND, WNDCLASSEXW,
        WS_OVERLAPPEDWINDOW,
    },
};

// ── libVLC opaque C types ────────────────────────────────────────────────────
type VlcInstance = c_void;
type VlcMedia = c_void;
type VlcMediaPlayer = c_void;

// ── libVLC function pointer types ────────────────────────────────────────────
type FnNew = unsafe extern "C" fn(i32, *const *const c_char) -> *mut VlcInstance;
type FnRelease = unsafe extern "C" fn(*mut VlcInstance);
type FnMediaNew = unsafe extern "C" fn(*mut VlcInstance, *const c_char) -> *mut VlcMedia;
type FnMediaRel = unsafe extern "C" fn(*mut VlcMedia);
type FnMpNew = unsafe extern "C" fn(*mut VlcMedia) -> *mut VlcMediaPlayer;
type FnMpSetHwnd = unsafe extern "C" fn(*mut VlcMediaPlayer, *mut c_void);
type FnMpPlay = unsafe extern "C" fn(*mut VlcMediaPlayer) -> i32;
type FnMpStop = unsafe extern "C" fn(*mut VlcMediaPlayer);
type FnMpRelease = unsafe extern "C" fn(*mut VlcMediaPlayer);

// ── Per-window state (heap-allocated, pinned via Box) ────────────────────────
struct PlayerState {
    mp: *mut VlcMediaPlayer,
    vlc: *mut VlcInstance,
    fn_mp_stop: FnMpStop,
    fn_mp_rel: FnMpRelease,
    fn_vlc_rel: FnRelease,
    // Library must outlive every function call above — keep it last.
    _lib: Library,
}

impl Drop for PlayerState {
    fn drop(&mut self) {
        unsafe {
            (self.fn_mp_stop)(self.mp);
            (self.fn_mp_rel)(self.mp);
            (self.fn_vlc_rel)(self.vlc);
        }
    }
}

// Raw pointers are !Send by default; we know these FFI handles are safe to
// move into the player thread.
unsafe impl Send for PlayerState {}

// ── Public API ───────────────────────────────────────────────────────────────

/// Spawn a background thread that opens a Win32 window and plays `url`
/// using the libVLC bundled in `vlc_dir`.
pub fn spawn_player(vlc_dir: &Path, url: &str) -> Result<(), String> {
    let vlc_dir = vlc_dir.to_path_buf();
    let url = url.to_string();
    std::thread::spawn(move || {
        if let Err(e) = player_thread(vlc_dir, url) {
            eprintln!("[vlc-player] {e}");
        }
    });
    Ok(())
}

// ── Thread body ──────────────────────────────────────────────────────────────

fn player_thread(vlc_dir: PathBuf, url: String) -> Result<(), String> {
    // 1. Load libvlc.dll from the embedded resources dir
    let dll_path = vlc_dir.join("libvlc.dll");
    let lib = unsafe { Library::new(&dll_path) }.map_err(|e| format!("load libvlc.dll: {e}"))?;

    // 2. Resolve every symbol we need
    macro_rules! sym {
        ($name:literal, $ty:ty) => {
            unsafe { *lib.get::<$ty>($name).map_err(|e| e.to_string())? }
        };
    }

    let fn_new: FnNew = sym!(b"libvlc_new\0", FnNew);
    let fn_release: FnRelease = sym!(b"libvlc_release\0", FnRelease);
    let fn_media_new: FnMediaNew = sym!(b"libvlc_media_new_location\0", FnMediaNew);
    let fn_media_rel: FnMediaRel = sym!(b"libvlc_media_release\0", FnMediaRel);
    let fn_mp_new: FnMpNew = sym!(b"libvlc_media_player_new_from_media\0", FnMpNew);
    let fn_mp_hwnd: FnMpSetHwnd = sym!(b"libvlc_media_player_set_hwnd\0", FnMpSetHwnd);
    let fn_mp_play: FnMpPlay = sym!(b"libvlc_media_player_play\0", FnMpPlay);
    let fn_mp_stop: FnMpStop = sym!(b"libvlc_media_player_stop\0", FnMpStop);
    let fn_mp_rel: FnMpRelease = sym!(b"libvlc_media_player_release\0", FnMpRelease);

    // 3. Tell libVLC where to find its plugins (must be set before libvlc_new)
    let plugin_dir = vlc_dir.join("plugins");
    std::env::set_var("VLC_PLUGIN_PATH", &plugin_dir);

    // 4. Create libvlc instance (no extra args needed — plugins found via env var)
    let vlc = unsafe { fn_new(0, std::ptr::null()) };
    if vlc.is_null() {
        return Err("libvlc_new returned null".into());
    }

    // 5. Create media from URL
    let url_c = CString::new(url).map_err(|e| e.to_string())?;
    let media = unsafe { fn_media_new(vlc, url_c.as_ptr()) };
    if media.is_null() {
        unsafe { fn_release(vlc) };
        return Err("libvlc_media_new_location returned null".into());
    }

    // 6. Create media player (this takes ownership of the media ref we pass)
    let mp = unsafe { fn_mp_new(media) };
    unsafe { fn_media_rel(media) };
    if mp.is_null() {
        unsafe { fn_release(vlc) };
        return Err("libvlc_media_player_new_from_media returned null".into());
    }

    // 7. Create the host Win32 window (not visible yet)
    let hwnd = create_window().map_err(|e| format!("create window: {e}"))?;

    // 8. Bind VLC video output to our window
    unsafe { fn_mp_hwnd(mp, hwnd as *mut c_void) };

    // 9. Heap-allocate state and attach it to the window for WndProc cleanup.
    //    Raw pointers are Copy, so `mp` / `vlc` remain usable below.
    let state_ptr = Box::into_raw(Box::new(PlayerState {
        mp,
        vlc,
        fn_mp_stop,
        fn_mp_rel,
        fn_vlc_rel: fn_release,
        _lib: lib,
    }));
    unsafe { SetWindowLongPtrW(hwnd, GWLP_USERDATA, state_ptr as isize) };

    // 10. Start playback, then make the window visible
    unsafe { fn_mp_play(mp) };
    unsafe { ShowWindow(hwnd, SW_SHOW) };

    // 11. Standard Win32 message loop — runs until WM_QUIT (posted by WM_DESTROY)
    let mut msg: MSG = unsafe { std::mem::zeroed() };
    loop {
        let r = unsafe { GetMessageW(&mut msg, 0, 0, 0) };
        if r == 0 || r == -1 {
            break;
        }
        unsafe {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    Ok(())
}

// ── Window procedure ─────────────────────────────────────────────────────────

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        // Suppress background erase — VLC fills the window entirely
        WM_ERASEBKGND => 1,

        WM_CLOSE => {
            // Stop VLC and free everything before the window is destroyed
            let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut PlayerState;
            if !ptr.is_null() {
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                drop(Box::from_raw(ptr)); // calls PlayerState::drop → stop/release
            }
            DestroyWindow(hwnd);
            0
        }

        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }

        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

// ── Window creation ──────────────────────────────────────────────────────────

fn create_window() -> Result<HWND, String> {
    unsafe {
        let class: Vec<u16> = "TauriVlcPlayer\0".encode_utf16().collect();
        let title: Vec<u16> = "Media Player\0".encode_utf16().collect();

        let hinstance = GetModuleHandleW(std::ptr::null());

        let wc = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(wnd_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: 0,
            hCursor: LoadCursorW(0, IDC_ARROW),
            hbrBackground: 0, // no brush — VLC renders the full surface
            lpszMenuName: std::ptr::null(),
            lpszClassName: class.as_ptr(),
            hIconSm: 0,
        };

        // Ignore "already registered" failures — safe to proceed
        RegisterClassExW(&wc);

        let hwnd = CreateWindowExW(
            0,
            class.as_ptr(),
            title.as_ptr(),
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            1280,
            720,
            0,
            0,
            hinstance,
            std::ptr::null(),
        );

        if hwnd == 0 {
            Err("CreateWindowExW failed".into())
        } else {
            Ok(hwnd)
        }
    }
}
