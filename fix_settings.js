const fs = require('fs');
const path = 'anchor/mobile/src/screens/settings/SettingsScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// handle windows CRLF
content = content.replace(/\r\n/g, '\n');

// 1. Remove imports
content = content.replace("import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';\n", "");
const imp = `import {
  syncDailyGoalNudgesFromStores,
  syncDailyReminderFromStores,
} from '@/services/DailyGoalNudgeService';\n`;
content = content.replace(imp, "");

// 2. Add toggleWeaver
content = content.replace(
  "const { notifState, toggleNotifications, updateActiveHours } = useNotificationController();",
  "const { notifState, toggleNotifications, updateActiveHours, toggleWeaver } = useNotificationController();"
);

// 3. Remove handlers
const handlersStart = "  const handleToggleDailyReminder = useCallback(";
const handlersEnd = "    [settings.dailyReminderEnabled, updateSetting]\n  );\n";

const sIdx = content.indexOf(handlersStart);
const eIdx = content.indexOf(handlersEnd) + handlersEnd.length;
if (sIdx !== -1 && eIdx > sIdx) {
  content = content.substring(0, sIdx) + content.substring(eIdx);
} else {
  console.log("Could not find handlers.");
}

// 4. Replace Reminder Time and Remove Notifications Section
const blockStartStr = `                <SettingsRow
                  title="Reminder Time"
                  subtitle="When Micro-Prime fires if you haven't primed"
                  value={formatHourLabel(notifState?.active_hours_end ?? 21)}
                  type="chevron"
                  onPress={() => setHourPickerTarget('reminder')}
                  disabled={isLoading}
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Notifications</Text>`;

const blockEndStr = `              showDivider={false}
            />
          </SettingsSectionBlock>

          {/* Appearance section removed */}`;

const blockStartIdx = content.indexOf(blockStartStr);
const blockEndIdx = content.indexOf(blockEndStr) + blockEndStr.length;

if (blockStartIdx !== -1 && blockEndIdx > blockStartIdx) {
  const replacement = `                <SettingsRow
                  title="Reminder Time"
                  subtitle="When Micro-Prime fires if you haven't primed"
                  value={formatHourLabel(notifState?.active_hours_end ?? 21)}
                  type="chevron"
                  onPress={() => setHourPickerTarget('reminder')}
                  disabled={isLoading}
                  showDivider={true}
                />
                <SettingsRow
                  title="Recovery Nudges"
                  subtitle="Gentle reminder when you've missed a day"
                  type="toggle"
                  toggleValue={notifState?.weaver_enabled ?? true}
                  onToggle={(enabled) => void toggleWeaver(enabled)}
                  disabled={isLoading}
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Appearance section removed */}`;

  content = content.substring(0, blockStartIdx) + replacement + content.substring(blockEndIdx);
} else {
  console.log("Could not find the block to replace.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
