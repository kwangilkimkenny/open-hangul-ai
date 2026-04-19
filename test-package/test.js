// Test script to verify open-hangul-ai package installation
try {
    const openHangulAI = require('open-hangul-ai');
    console.log('✅ Package imported successfully!');
    console.log('Available exports:', Object.keys(openHangulAI));
    console.log('Package version:', openHangulAI.VERSION || 'Version not available');
} catch (error) {
    console.error('❌ Failed to import package:', error.message);
    process.exit(1);
}