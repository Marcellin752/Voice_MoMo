const fs = require('fs');
const path = 'Mobile/android/app/src/main/java/com/voicemomo/app/MainActivity.java';
let java = fs.readFileSync(path, 'utf8');

if (!java.includes("UssdAccessibilityPlugin")) {
    java = java.replace(/registerPlugin\(UssdBackgroundPlugin\.class\);/, 'registerPlugin(UssdBackgroundPlugin.class);\n        registerPlugin(UssdAccessibilityPlugin.class);');
    fs.writeFileSync(path, java);
}
