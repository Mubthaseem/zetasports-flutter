import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDSZkTynabN6kiYZyNtSZc35atXgQYbRiA',
    appId: '1:500544502674:web:d0f19312ef703352b41f4b',
    messagingSenderId: '500544502674',
    projectId: 'zeta-sports',
    authDomain: 'zeta-sports.firebaseapp.com',
    storageBucket: 'zeta-sports.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDSZkTynabN6kiYZyNtSZc35atXgQYbRiA',
    appId: '1:500544502674:android:d0f19312ef703352b41f4b',
    messagingSenderId: '500544502674',
    projectId: 'zeta-sports',
    storageBucket: 'zeta-sports.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDSZkTynabN6kiYZyNtSZc35atXgQYbRiA',
    appId: '1:500544502674:ios:d0f19312ef703352b41f4b',
    messagingSenderId: '500544502674',
    projectId: 'zeta-sports',
    storageBucket: 'zeta-sports.firebasestorage.app',
    iosBundleId: 'com.zetasports.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyDSZkTynabN6kiYZyNtSZc35atXgQYbRiA',
    appId: '1:500544502674:ios:d0f19312ef703352b41f4b',
    messagingSenderId: '500544502674',
    projectId: 'zeta-sports',
    storageBucket: 'zeta-sports.firebasestorage.app',
    iosBundleId: 'com.zetasports.app',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyDSZkTynabN6kiYZyNtSZc35atXgQYbRiA',
    appId: '1:500544502674:web:d0f19312ef703352b41f4b',
    messagingSenderId: '500544502674',
    projectId: 'zeta-sports',
    authDomain: 'zeta-sports.firebaseapp.com',
    storageBucket: 'zeta-sports.firebasestorage.app',
  );
}
