use gilrs::{Gilrs, Event, EventType, Button, Axis};
use tauri::Emitter;

pub fn start_gamepad_listener(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut gilrs = match Gilrs::new() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("Erro ao inicializar gamepad: {}", e);
                return;
            }
        };

        println!("Listener de gamepad iniciado, aguardando eventos...");

        loop {
            while let Some(Event { event, .. }) = gilrs.next_event() {
                match event {
                    EventType::ButtonPressed(button, _) => {
                        println!("Botao pressionado: {:?}", button);
                        let action = match button {
                            Button::DPadUp        => Some("dpad_up"),
                            Button::DPadDown      => Some("dpad_down"),
                            Button::DPadLeft      => Some("dpad_left"),
                            Button::DPadRight     => Some("dpad_right"),
                            Button::South         => Some("confirm"),
                            Button::East          => Some("back"),
                            Button::North         => Some("favorite"),
                            Button::Start         => Some("menu"),
                            Button::Select        => Some("select"),
                            Button::LeftTrigger2  => Some("trigger_left"),
                            Button::RightTrigger2 => Some("trigger_right"),
                            Button::LeftTrigger   => Some("bumper_left"),
                            Button::RightTrigger  => Some("bumper_right"),
                            _ => None,
                        };
                        if let Some(action) = action {
                            app.emit("gamepad_input", action).ok();
                        }
                    }
                    EventType::ButtonReleased(button, _) => {
                        let action = match button {
                            Button::Start  => Some("menu_release"),
                            Button::Select => Some("select_release"),
                            _ => None,
                        };
                        if let Some(action) = action {
                            app.emit("gamepad_input", action).ok();
                        }
                    }
                    EventType::AxisChanged(axis, value, _) => {
                        println!("Eixo: {:?} = {:.2}", axis, value);
                        let action = match axis {
                            Axis::DPadX if value > 0.5  => Some("dpad_right"),
                            Axis::DPadX if value < -0.5 => Some("dpad_left"),
                            Axis::DPadY if value > 0.5  => Some("dpad_up"),
                            Axis::DPadY if value < -0.5 => Some("dpad_down"),
                            Axis::LeftStickX if value > 0.7  => Some("dpad_right"),
                            Axis::LeftStickX if value < -0.7 => Some("dpad_left"),
                            Axis::LeftStickY if value > 0.7  => Some("dpad_up"),
                            Axis::LeftStickY if value < -0.7 => Some("dpad_down"),
                            _ => None,
                        };
                        if let Some(action) = action {
                            app.emit("gamepad_input", action).ok();
                        }
                    }
                    EventType::Connected => println!("Controle conectado!"),
                    EventType::Disconnected => println!("Controle desconectado!"),
                    _ => {}
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });
}