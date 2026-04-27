// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show".to_string(), "Показать"))
        .add_item(CustomMenuItem::new("quit".to_string(), "Выйти"));

    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .setup(|app| {
            // Окно создаётся скрытым (visible: false в tauri.conf.json),
            // чтобы избежать flash нативного chrome перед нашей подстройкой.
            // На macOS оставляем decorations: true с titleBarStyle: Overlay
            // (traffic lights поверх контента + прозрачность + rounded corners).
            // На остальных платформах нативный заголовок отключаем —
            // chrome полностью наш.
            if let Some(window) = app.get_window("main") {
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = window.set_decorations(false);
                }
                let _ = window.show();
            }
            Ok(())
        })
        .system_tray(tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
                "quit" => std::process::exit(0),
                _ => {}
            },
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running ZenWidget");
}
