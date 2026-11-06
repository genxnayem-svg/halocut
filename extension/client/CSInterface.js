/**
 * Minimal CSInterface implementation — Adobe CEP bridge.
 * Provides just what we need: evalScript and getSystemPath.
 * Based on Adobe's open-source CSInterface (MIT-licensed).
 */
function SystemPath() {}
SystemPath.USER_DATA   = "userData";
SystemPath.COMMON_FILES = "commonFiles";
SystemPath.MY_DOCUMENTS = "myDocuments";
SystemPath.APPLICATION = "application";
SystemPath.EXTENSION   = "extension";
SystemPath.HOST_APPLICATION = "hostApplication";

function CSInterface() {}

/**
 * Evaluate ExtendScript in the host application.
 * @param {string} script  ExtendScript code to run.
 * @param {function} callback  Receives the script's return value (string).
 */
CSInterface.prototype.evalScript = function (script, callback) {
  if (typeof callback !== "function") {
    callback = function () {};
  }
  // window.__adobe_cep__ is injected by CEP at panel load time.
  window.__adobe_cep__.evalScript(script, callback);
};

/**
 * Resolve a system path. We mainly need EXTENSION (this plugin's folder).
 */
CSInterface.prototype.getSystemPath = function (pathType) {
  var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
  // On macOS the path is prefixed with file://
  if (path.indexOf("file://") === 0) path = path.substring(7);
  return path;
};

/**
 * Get info about the host application (name, version).
 */
CSInterface.prototype.getHostEnvironment = function () {
  return JSON.parse(window.__adobe_cep__.getHostEnvironment());
};

/**
 * Open a URL in the user's default browser.
 */
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  cep.util.openURLInDefaultBrowser(url);
};
