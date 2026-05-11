const fs = require('fs');
const path = 'Mobile/android/app/src/main/AndroidManifest.xml';
let xml = fs.readFileSync(path, 'utf8');

const serviceXml = `
        <service android:name=".UssdAccessibilityService"
                 android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
                 android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>
    </application>`;

if (!xml.includes("UssdAccessibilityService")) {
    xml = xml.replace(/<\/application>/, serviceXml);
    fs.writeFileSync(path, xml);
    console.log("Manifest updated.");
} else {
    console.log("Manifest already contains the service.");
}
