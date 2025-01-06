import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const WaydroidToggle = GObject.registerClass(
class WaydroidToggle extends QuickSettings.QuickToggle {
    constructor() {
        super({
            title: 'Waydroid',
            iconName: 'phone-symbolic',
            toggleMode: true,
        });

        this._checkServiceStatus();

        // Add periodic status check (every 5 seconds)
        this._statusCheckId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            this._checkServiceStatus();
            return GLib.SOURCE_CONTINUE;
        });

        this.connect('clicked', () => {
            if (this.checked) {
                this._startWaydroid();
            } else {
                this._stopWaydroid();
            }
        });
    }

    _startWaydroid() {
        try {
            GLib.spawn_command_line_async('waydroid session start');
        } catch (e) {
            console.error(e);
        }
    }

    _stopWaydroid() {
        try {
            GLib.spawn_command_line_async('waydroid session stop');
        } catch (e) {
            console.error(e);
        }
    }

    _checkServiceStatus() {
        try {
            let [success, stdout, stderr] = GLib.spawn_command_line_sync('waydroid status');
            if (success) {
                let output = new TextDecoder().decode(stdout);
                let lines = output.split('\n');

                // Check both Session and Container status
                let session_running = lines.some(line =>
                    line.trim().startsWith('Session:') &&
                    line.includes('RUNNING')
                );

                let container_running = lines.some(line =>
                    line.trim().startsWith('Container:') &&
                    line.includes('RUNNING')
                );

                // Set checked if both are running
                this.set_checked(session_running && container_running);
            } else {
                this.set_checked(false);
            }
        } catch (e) {
            console.error(e);
            this.set_checked(false);
        }
    }

    destroy() {
        if (this._statusCheckId) {
            GLib.source_remove(this._statusCheckId);
            this._statusCheckId = null;
        }
        super.destroy();
    }
});

const WaydroidIndicator = GObject.registerClass(
class WaydroidIndicator extends QuickSettings.SystemIndicator {
    constructor(toggle) {
        super();
        this.quickSettingsItems.push(toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class WaydroidExtension extends Extension {
    enable() {
        const toggle = new WaydroidToggle();
        this._indicator = new WaydroidIndicator(toggle);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}

