import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * FIKRA SELL · سيـ فكرة ـل — Expo configuration.
 * Public runtime values come from EXPO_PUBLIC_* environment variables
 * (see .env.example). No secret ever belongs in this file.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';
// Public client configuration (safe to ship: every permission is enforced by RLS).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zczwryruucliofnkqraa.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_hlky83lju1gItEAqtjqeHQ_JTo-S69X';
// Expo Go only loads updates whose runtime is the SDK version.
const FOR_EXPO_GO = process.env.EXPO_GO_PREVIEW === '1';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '2a70f95d-19f4-4a15-9ef6-ec2ccca4b9aa'; // @azizqet/fikra-sell

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'FIKRA SELL (Dev)' : 'FIKRA SELL',
  slug: 'fikra-sell',
  owner: process.env.EXPO_OWNER ?? 'azizqet',
  scheme: 'fikrasell',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/brand/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FFFFFF',
  runtimeVersion: FOR_EXPO_GO ? { policy: 'sdkVersion' } : { policy: 'appVersion' },
  updates: EAS_PROJECT_ID ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } : undefined,
  ios: {
    bundleIdentifier: IS_DEV ? 'com.fikrasell.app.dev' : 'com.fikrasell.app',
    buildNumber: '1',
    supportsTablet: false,
    usesAppleSignIn: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDevelopmentRegion: 'ar',
      CFBundleLocalizations: ['ar', 'en'],
      NSCameraUsageDescription: 'يستخدم «سيـ فكرة ـل» الكاميرا لالتقاط صور إعلانك. FIKRA SELL uses the camera to take photos for your ad.',
      NSPhotoLibraryUsageDescription: 'يستخدم «سيـ فكرة ـل» ألبوم الصور لاختيار صور إعلانك أو صورتك الشخصية. FIKRA SELL uses your photos to add pictures to your ad or profile.',
      NSLocationWhenInUseUsageDescription: 'نستخدم موقعك التقريبي فقط لعرض الإعلانات القريبة منك وتحديد موقع إعلانك. We use your approximate location only to show nearby ads.',
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
      ],
    },
  },
  android: {
    package: IS_DEV ? 'com.fikrasell.app.dev' : 'com.fikrasell.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/brand/adaptive-foreground.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
      backgroundColor: '#FFFFFF',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.CAMERA', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.READ_MEDIA_VIDEO'],
    intentFilters: [
      { action: 'VIEW', category: ['BROWSABLE', 'DEFAULT'], data: [{ scheme: 'fikrasell' }] },
    ],
  },
  web: { favicon: './assets/brand/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/brand/splash-icon.png', imageWidth: 180, resizeMode: 'contain', backgroundColor: '#FFFFFF', dark: { image: './assets/brand/splash-icon-dark.png', backgroundColor: '#0E0F13' } }],
    'expo-secure-store',
    'expo-font',
    ['expo-localization', { supportsRTL: true }],
    'expo-web-browser',
    ['expo-image-picker', {
      photosPermission: 'يستخدم «سيـ فكرة ـل» ألبوم الصور لاختيار صور إعلانك. FIKRA SELL uses your photos to add pictures to your ad.',
      cameraPermission: 'يستخدم «سيـ فكرة ـل» الكاميرا لالتقاط صور إعلانك. FIKRA SELL uses the camera to take ad photos.',
      microphonePermission: false,
    }],
    ['expo-location', { locationWhenInUsePermission: 'نستخدم موقعك التقريبي فقط لعرض الإعلانات القريبة منك. We use your approximate location only to show nearby ads.', isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false }],
    ['expo-notifications', { icon: './assets/brand/notification-icon.png', color: '#FFFFFF', defaultChannel: 'default' }],
    'expo-sharing',
    'expo-status-bar',
    'expo-image',
  ],
  experiments: { typedRoutes: false },
  extra: {
    supportsRTL: true,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
    router: { origin: false },
  },
});
