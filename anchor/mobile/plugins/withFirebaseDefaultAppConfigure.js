const { withAppDelegate } = require('expo/config-plugins');

// The iOS JS bridge calls Firebase's default app before React Native Firebase has
// created it natively, which throws "No Firebase App '[DEFAULT]'". Create the default
// app explicitly at launch. The guard keeps this safe if RNFB already configured it,
// because a second FirebaseApp.configure() call is fatal.
const SWIFT_IMPORT = 'import FirebaseCore';
const SWIFT_CONFIGURE = '    if FirebaseApp.app() == nil { FirebaseApp.configure() }';
const OBJC_IMPORT = '#import <FirebaseCore/FirebaseCore.h>';
const OBJC_CONFIGURE = '  if ([FIRApp defaultApp] == nil) { [FIRApp configure]; }';

function addSwift(contents) {
  if (contents.includes(SWIFT_CONFIGURE)) return contents;
  const launch = /(didFinishLaunchingWithOptions[^{]*\{\n)/;
  if (!launch.test(contents)) {
    throw new Error('withFirebaseDefaultAppConfigure: didFinishLaunchingWithOptions not found in AppDelegate.swift');
  }
  let next = contents.replace(launch, `$1${SWIFT_CONFIGURE}\n`);
  if (!next.includes(SWIFT_IMPORT)) {
    next = next.replace(/^import .*$/m, (line) => `${SWIFT_IMPORT}\n${line}`);
  }
  return next;
}

function addObjC(contents) {
  if (contents.includes(OBJC_CONFIGURE)) return contents;
  const launch = /(didFinishLaunchingWithOptions:[^{]*\{\n)/;
  if (!launch.test(contents)) {
    throw new Error('withFirebaseDefaultAppConfigure: didFinishLaunchingWithOptions not found in AppDelegate');
  }
  let next = contents.replace(launch, `$1${OBJC_CONFIGURE}\n`);
  if (!next.includes(OBJC_IMPORT)) {
    next = `${OBJC_IMPORT}\n${next}`;
  }
  return next;
}

module.exports = function withFirebaseDefaultAppConfigure(config) {
  return withAppDelegate(config, (cfg) => {
    const { contents, language } = cfg.modResults;
    cfg.modResults.contents = language === 'swift' ? addSwift(contents) : addObjC(contents);
    return cfg;
  });
};
