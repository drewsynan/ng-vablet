# ng-vablet
Angular bindings to the Vablet native interface

#Getting started
To install ng-vablet, add the script `<script src="ng-vablet.js"></script>` to your app's index.html page, and add `ngVablet` as a dependency in the main app definition. You can now inject `vablet` and `vabletDev` wherever you need.

Alternatively, the library may be used on its own, without angular. Simply add `<script src="path/to/ng-vablet.js"></script>` in your document, which will create a global `vablet` and `vabletDev` objects. This approach does require the `Q` library, as well as the `VabletNativeInterface` library to be present and loaded.

##Basic usage
ng-vablet uses a promise-based approach to wrapping the `VabletNativeInterface`. It provides two services, `vablet` and `vabletDev`, which are identical, except `vabletDev` allows mocking of return values, and `vablet` ignores all calls to `.mock`.

ngVablet can only be used after the `VabletNativeInterface` has loaded.

Example usage:

```javascript
vablet.getIdForFileName("My Great File")
  .then(function(fileId) {
    return vablet.getThumbnailForFileId(fileId);
   }).then(function(base64Data) {
      magicalDomManipulation(base64Data);
   }).catch(function(e) {
      throw e;
   });

...

vablet.reportPageChange(32);

```

##Features
In addition to providing all of the functions outlined in the `VabletNativeInterface` documentation (as well as standardized versions that start with lowercase letters, per standard JS style), the library also provides 

* a unified `vablet.email` function that encompases both `sendEmailForFiles` and `SendEmail`.
* helper `vablet.getIdForFileName`
* helper `vablet.getFileNameForId`
* `vablet.mock` to allow simulation of values and timeouts returned by the native interface for testing and development purposes.

### vablet.email
`vablet.email(message, config)` takes a message object, and a config object. If attachments are specified in the message object, the native `sendEmailForFiles` is used, otherwise, `SendEmail` is used internally. Currently an array of `fileIds` (not *names*) must be provided. In the future, this will automagically be resolved.

Example:

```javascript
var message = {
  to: "someone@hello.co.uk"
  cc: ["myboss@work.biz", "myTeam@work.biz"]
  subject: "It's a great day",
  body: "Hey there, thanks again for the terrific meeting we had today. Please refs, attached."
  attachments: []
}

var config = {
  disableEmailTemplate: true
}

vablet.getIdForFileName(["great-stuff1.pdf","greatStuff3.pdf","notes.ppt"])
  .then(function(files) {
    return messageWithAttachments = Object.assign({}, message).attachments = files;
   }).then(function(messageWithFiles) {
    return vablet.email(messageWithFiles, config);
   }).then(function() {
    notify("Email sucessfully sent/queued");
   }).catch(function(e) {
    notify("There was a problem sending the email.")
    errLog(e);
   });
```

### vabletDev.mock
Mocking is only enabled on the vabletDev binding. When using the normal `vablet` object, the mock function becomes a no-op, and is simply ignored, with all values being passed to the native interface.

Example:

```javascript
/* vabletDev.mock(mockValue, mockTimeout) */

var vablet = vabletDev;

var unsuccessfulIO = vablet.mock({success: false, error: "My Error String"}, 500);

unsuccessfulIO.email(message, config).then(function() {
  console.log("success!");
}).catch(function(e) {
  console.log(e)
}); // logs "My Error String" after 500 ms
