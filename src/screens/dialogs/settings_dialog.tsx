import React, { useEffect, useState } from 'react';
import {
  Activity,
  Music,
  Trash2,
  Unlock,
  Volume2,
  Vibrate,
  X,
} from 'lucide-react';
import {
  ALL_MUSIC_TRACKS,
  ALL_SFX_NAMES,
  audioService,
} from '../../core/audio_service';
import { GameConstants } from '../../core/constants';
import { LayoutSpec } from '../../core/layout/screen_layout';
import { GameTheme } from '../../core/theme/game_theme';
import {
  GameSettingsData,
  globalSettingsNotifier,
} from '../../logic/settings';

export interface SettingsDialogProps {
  theme: GameTheme;
  layout: LayoutSpec;
  allUnlocked: boolean;
  onResetConfirmed: () => void;
  onToggleUnlockAll: (unlocked: boolean) => void;
  onClose: () => void;
}

/**
 * Settings dialog (Step 5 Part C):
 * - Title "Settings"
 * - Music Volume slider (0-100%)
 * - SFX Volume slider (0-100%)
 * - Vibration toggle switch
 * - Reduced Motion toggle switch
 * - "Reset progress" button with confirmation dialog
 * - "Unlock all levels" debug switch
 * - Saved under `bonk_pop_settings_v1`
 * Mirrors `lib/screens/dialogs/settings_dialog.dart`.
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  theme,
  layout,
  allUnlocked,
  onResetConfirmed,
  onToggleUnlockAll,
  onClose,
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [settings, setSettings] = useState<GameSettingsData>(
    globalSettingsNotifier.settings
  );

  useEffect(() => {
    return globalSettingsNotifier.addListener((s) => {
      setSettings(s);
    });
  }, []);

  const updateSetting = <K extends keyof GameSettingsData>(
    key: K,
    val: GameSettingsData[K]
  ) => {
    globalSettingsNotifier.update({ [key]: val });
    if (key === 'sfxVolume' && typeof val === 'number' && val > 0.05) {
      audioService.playClick();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmingReset) {
          setConfirmingReset(false);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && confirmingReset) {
        e.preventDefault();
        onResetConfirmed();
        setConfirmingReset(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmingReset, onClose, onResetConfirmed]);

  const dlg = theme.dialogFrame;
  const btn = theme.buttonStyle;
  const hud = theme.hud;
  const s = layout.uiScale;
  const minBtnH = Math.max(
    GameConstants.minTouchTarget,
    Math.round(44 * Math.min(1.2, s))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={confirmingReset ? 'Reset progress?' : 'Settings'}
      data-testid="settings-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: dlg.overlayScrimColor }}
    >
      <div
        style={{
          width: `${layout.dialogMaxWidth}px`,
          maxWidth: '100%',
          maxHeight: '90dvh',
          backgroundColor: dlg.backgroundColor,
          borderColor: dlg.borderColor,
          borderRadius: `${dlg.cornerRadius}px`,
          boxShadow: `0 0 36px ${dlg.glowColor}`,
        }}
        className="relative border-[3px] p-5 sm:p-6 flex flex-col items-center text-center overflow-y-auto"
      >
        {!confirmingReset ? (
          <>
            <button
              type="button"
              aria-label="Close Settings"
              data-testid="settings-close-button"
              onClick={() => {
                audioService.playClick();
                onClose();
              }}
              style={{
                width: `${GameConstants.minTouchTarget}px`,
                height: `${GameConstants.minTouchTarget}px`,
                backgroundColor: hud.badgeBackground,
                borderColor: hud.badgeBorder,
                color: hud.textPrimary,
              }}
              className="absolute top-3.5 right-3.5 rounded-full border flex items-center justify-center cursor-pointer hover:brightness-110"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <h2
              style={{
                fontFamily: theme.titleFontFamily,
                color: hud.textPrimary,
                fontSize: `${Math.round(22 * Math.min(1.2, s))}px`,
              }}
              className="font-extrabold mb-4"
            >
              Settings
            </h2>

            {/* Audio Sliders & Toggles Panel */}
            <div
              style={{
                backgroundColor: hud.badgeBackground,
                borderColor: hud.badgeBorder,
              }}
              className="w-full rounded-2xl border p-3.5 mb-3 flex flex-col gap-3 text-left"
            >
              {/* Music Volume */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span
                    style={{
                      fontFamily: theme.titleFontFamily,
                      color: hud.textPrimary,
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Music className="w-4 h-4 text-pink-400" />
                    <span>Music Volume</span>
                  </span>
                  <span
                    style={{ color: hud.textSecondary }}
                    className="tabular-nums"
                  >
                    {Math.round(settings.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  aria-label="Music Volume"
                  data-testid="music-volume-slider"
                  value={settings.musicVolume}
                  onChange={(e) =>
                    updateSetting('musicVolume', parseFloat(e.target.value))
                  }
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span
                    style={{
                      fontFamily: theme.titleFontFamily,
                      color: hud.textPrimary,
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Volume2 className="w-4 h-4 text-pink-400" />
                    <span>Sound Effects</span>
                  </span>
                  <span
                    style={{ color: hud.textSecondary }}
                    className="tabular-nums"
                  >
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  aria-label="Sound Effects Volume"
                  data-testid="sfx-volume-slider"
                  value={settings.sfxVolume}
                  onChange={(e) =>
                    updateSetting('sfxVolume', parseFloat(e.target.value))
                  }
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              {/* Vibration Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-pink-100/30">
                <label
                  htmlFor="vibration-switch"
                  style={{
                    fontFamily: theme.titleFontFamily,
                    color: hud.textPrimary,
                  }}
                  className="text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Vibrate className="w-4 h-4 text-pink-400" />
                  <span>Haptic Vibration</span>
                </label>
                <input
                  id="vibration-switch"
                  type="checkbox"
                  role="switch"
                  aria-label="Vibration"
                  data-testid="vibration-switch"
                  checked={settings.vibration}
                  onChange={(e) => {
                    updateSetting('vibration', e.target.checked);
                    if (e.target.checked) audioService.vibrate('light');
                  }}
                  className="w-5 h-5 accent-pink-500 cursor-pointer"
                />
              </div>

              {/* Reduced Motion Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-pink-100/30">
                <label
                  htmlFor="reduced-motion-switch"
                  style={{
                    fontFamily: theme.titleFontFamily,
                    color: hud.textPrimary,
                  }}
                  className="text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-pink-400" />
                  <span>Reduced Motion</span>
                </label>
                <input
                  id="reduced-motion-switch"
                  type="checkbox"
                  role="switch"
                  aria-label="Reduced Motion"
                  data-testid="reduced-motion-switch"
                  checked={settings.reducedMotion}
                  onChange={(e) =>
                    updateSetting('reducedMotion', e.target.checked)
                  }
                  className="w-5 h-5 accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Debug Switch: Unlock all levels */}
            <div
              style={{
                backgroundColor: hud.badgeBackground,
                borderColor: hud.badgeBorder,
              }}
              className="w-full rounded-2xl border p-3.5 mb-3 flex items-center justify-between gap-3"
            >
              <label
                htmlFor="unlock-all-switch"
                style={{
                  fontFamily: theme.titleFontFamily,
                  color: hud.textPrimary,
                }}
                className="text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Unlock
                  className="w-4 h-4 shrink-0"
                  style={{ color: hud.textSecondary }}
                  aria-hidden="true"
                />
                <span>Unlock all levels</span>
              </label>

              <input
                id="unlock-all-switch"
                type="checkbox"
                role="switch"
                aria-label="Unlock all levels"
                data-testid="unlock-all-switch"
                checked={allUnlocked}
                onChange={(e) => {
                  audioService.playClick();
                  onToggleUnlockAll(e.target.checked);
                }}
                className="w-5 h-5 accent-pink-500 cursor-pointer"
              />
            </div>

            {/* Debug-only Sound test list: one button per SFX and per music loop */}
            {import.meta.env.DEV && (
              <div
                data-testid="sound-test-panel"
                style={{
                  backgroundColor: hud.badgeBackground,
                  borderColor: hud.badgeBorder,
                }}
                className="w-full rounded-2xl border p-3 mb-3 flex flex-col gap-2 text-left"
              >
                <span
                  style={{
                    fontFamily: theme.titleFontFamily,
                    color: hud.textPrimary,
                  }}
                  className="text-xs font-bold"
                >
                  Sound test (Debug)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SFX_NAMES.map((sfxName) => (
                    <button
                      key={sfxName}
                      type="button"
                      data-testid={`sound-test-sfx-${sfxName}`}
                      onClick={() => audioService.playSfx(sfxName)}
                      style={{
                        backgroundColor: dlg.backgroundColor,
                        borderColor: hud.badgeBorder,
                        color: hud.textPrimary,
                        fontFamily: theme.titleFontFamily,
                      }}
                      className="px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer hover:brightness-105 active:scale-95"
                    >
                      {sfxName}
                    </button>
                  ))}
                  {ALL_MUSIC_TRACKS.map((trackName) => (
                    <button
                      key={trackName}
                      type="button"
                      data-testid={`sound-test-bgm-${trackName}`}
                      onClick={() => audioService.playMusic(trackName, true)}
                      style={{
                        backgroundColor: btn.secondaryBackground,
                        borderColor: btn.secondaryBorder,
                        color: btn.secondaryText,
                        fontFamily: theme.titleFontFamily,
                      }}
                      className="px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer hover:brightness-105 active:scale-95"
                    >
                      {trackName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="reset-progress-button"
              onClick={() => {
                audioService.playClick();
                setConfirmingReset(true);
              }}
              style={{
                minHeight: `${minBtnH}px`,
                backgroundColor: btn.dangerBackground,
                borderColor: btn.dangerBorder,
                color: btn.dangerText,
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full border-2 font-bold px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 shadow-md"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Reset progress</span>
            </button>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: theme.titleFontFamily,
                color: hud.textPrimary,
                fontSize: `${Math.round(20 * Math.min(1.2, s))}px`,
              }}
              className="font-extrabold mb-3"
            >
              Reset progress?
            </h2>

            <p
              style={{ color: hud.textSecondary }}
              className="text-sm font-medium leading-relaxed mb-6"
            >
              This will delete all stars, unlocked levels, and best scores. This
              action cannot be undone.
            </p>

            <div className="w-full flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                data-testid="cancel-reset-button"
                onClick={() => {
                  audioService.playClick();
                  setConfirmingReset(false);
                }}
                style={{
                  minHeight: `${minBtnH}px`,
                  backgroundColor: hud.badgeBackground,
                  borderColor: hud.badgeBorder,
                  color: hud.textPrimary,
                  borderRadius: `${btn.cornerRadius}px`,
                  fontFamily: theme.titleFontFamily,
                }}
                className="w-full sm:flex-1 border-2 font-bold px-4 py-2 flex items-center justify-center cursor-pointer hover:brightness-105 active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                data-testid="confirm-reset-button"
                onClick={() => {
                  audioService.playClick();
                  onResetConfirmed();
                  setConfirmingReset(false);
                  onClose();
                }}
                style={{
                  minHeight: `${minBtnH}px`,
                  backgroundColor: btn.dangerBackground,
                  borderColor: btn.dangerBorder,
                  color: btn.dangerText,
                  borderRadius: `${btn.cornerRadius}px`,
                  fontFamily: theme.titleFontFamily,
                }}
                className="w-full sm:flex-1 border-2 font-bold px-4 py-2 flex items-center justify-center cursor-pointer hover:brightness-105 active:scale-95 shadow-md"
              >
                Delete everything
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
