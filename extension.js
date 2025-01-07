import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ICON_LOADING = "process-working-symbolic";
const ICON_STOPPED = "system-shutdown-symbolic";
const ICON_FROZEN = "media-playback-pause-symbolic";
const ICON_RUNNING = "phone-symbolic";


const WaydroidToggle = GObject.registerClass(
class WaydroidToggle extends QuickSettings.QuickToggle {
    constructor() {
        super({
            title: 'Waydroid',
            iconName: ICON_LOADING,
            toggleMode: true,
        });

        this._isFrozen = false;
        this._isStopped = false;
        this._checkServiceStatus();

        this._statusCheckId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            this._checkServiceStatus();
            return GLib.SOURCE_CONTINUE;
        });

        this.connect('clicked', () => {
            if (!this.checked) {
                this._stopWaydroid();
            } else if (this._isFrozen) {
                this._stopWaydroid();
            } else {
                this._startWaydroid();
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

    _updateIcon(isFrozen, isStopped) {
        if (isStopped) {
            this.iconName = ICON_STOPPED;
        } else if (isFrozen) {
            this.iconName = ICON_FROZEN;
        } else {
            this.iconName = ICON_RUNNING;
        }
    }

    _checkServiceStatus() {
        try {
            let [success, stdout, stderr] = GLib.spawn_command_line_sync('waydroid status');
            if (success) {
                let output = new TextDecoder().decode(stdout);
                let lines = output.split('\n');

                let session_line = lines.find(line =>
                    line.trim().startsWith('Session:')
                );
                let session_running = session_line?.includes('RUNNING') ?? false;
                let session_stopped = session_line?.includes('STOPPED') ?? false;

                let container_line = lines.find(line =>
                    line.trim().startsWith('Container:')
                );

                let container_running = container_line?.includes('RUNNING') ?? false;
                let container_frozen = container_line?.includes('FROZEN') ?? false;

                this._isFrozen = container_frozen;
                this._isStopped = session_stopped;

                this._updateIcon(container_frozen, session_stopped);

                this.set_checked(session_running && (container_running || container_frozen));
            } else {
                this._isFrozen = false;
                this._isStopped = true;
                this._updateIcon(false, true);
                this.set_checked(false);
            }
        } catch (e) {
            console.error(e);
            this._isFrozen = false;
            this._isStopped = true;
            this._updateIcon(false, true);
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

