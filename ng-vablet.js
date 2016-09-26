(function (definition) {

    // Turn off strict mode for this function so we can assign to global.vablet

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.
    
    // angularJS
    if (typeof angular === "object") {
    	angular.module('ngVablet', [])
    		   .provider('vabletDev', function(){
    		   		this.$get = function($q){
    		   			return definition($q);
    		   		}
    		   })
    		   .provider('vablet', function(){ // production, ignore all mock specs
    		   		this.$get = function($q){
    		   			return definition($q, true);
    		   		}
    		   });
    // CommonJS
    } else if (typeof exports === "object") {
    	var q = require('q');
    	module.exports = definition(q);

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(['require','q'], function(require, q) {
        	var q = require('q');
        	return definition(q);
        });

    // <script>
    } else {
    	if(typeof Q === "function") {
        	vablet = definition(Q, true);
        	vabletDev = definition(Q);
        } else {
        	throw new Error("Vablet: Could not find Q library");
        }
    }
})(function vabletApi(Q,IN_PRODUCTION) {

IN_PRODUCTION = IN_PRODUCTION || false;

/*
 * TYPES *
         */

var types = {
		any: (function(){
				var f = function any(x) { return true; };
				f.toString = function() { return "any"; }
				return f;
		}()),
		string: (function(){
				var f = function string(x) { return typeof x === 'string'; };
				f.toString = function() { return "string"; }
				return f;
			}()),
		number: (function(){
				var f = function number(x) { return typeof x === 'number'; };
				f.toString = function() { return "number"; }
				return f;
			}()),
		boolean: (function(){
				var f = function boolean(x) { return typeof x === 'boolean'; };
				f.toString = function() { return "boolean"; };
				return f;
			}()),
		array: (function(){
				var f = function array(x) { return Array.isArray(x); };
				f.toString = function() { return "array"; };
				return f;
			}()),
		object: (function(){
				var f = function object(x) { return typeof x === 'object' && !Array.isArray(x); };
				f.toString = function() { return "object"; };
				return f;
			}()),
		function: (function(){
				var f = function func(x) { return typeof x === 'function'; };
				f.toString = function() { return "function"; };
				return f;
		}()),
		numberOrString: (function(){
			var f = function(x) { return types.string(x) || types.number(x); };
			f.toString = function numberOrString() { return "number or string"; }
			return f;
		}()),
		arrayOf: function(t) { 
			var f = function arrayOf(x) { 
				if(!Array.isArray(x)) { return false; }
				return x.reduce(function(acc, item) { return acc && t(item); }, true);
				}; 
			f.toString = function() { return "array of <" + String(t) + ">"; }
			return f;
		},
		objectOf: function(proto) { 
			var f = function objectOf(x) {
				if(typeof x !== "object") return false;
				if(Array.isArray(x)) return false;

				var protoKeys = Object.keys(proto).sort();
				var xKeys = Object.keys(x).sort();

				if(protoKeys.length !== xKeys.length) { 
					// console.log("wrong number of keys");
					return false; 
				}

				var namesAllMatch = true;
				for(var i=0; i<protoKeys.length; i++) {
					namesAllMatch = namesAllMatch && (protoKeys[i] === xKeys[i]);
				}

				if(!namesAllMatch) {
					// console.log("key names don't match")
					return false;
				}

				var allKeysValid = true;
				for(var i=0; i<protoKeys.length; i++) {
					var predicate = proto[protoKeys[i]];
					allKeysValid = allKeysValid && predicate(x[xKeys[i]]);
				}

				if(!allKeysValid) {
					// console.log("keys aren't valid");
				}
				return allKeysValid;
			};
			f.toString = function() { 
				var kv = Object.keys(proto).map(function(k){
					return k + ":<" + proto[k] + ">";
				});
				return "object of {" + kv.join(",") + "}"; 
			};
			return f;
		},
		valueOf: function(v) {
			var f = function valueOf(x) { return x === v; };
			f.toString = function() { return "value literal of " + String(v); }
			return f;
		}
	};

function Left(e) { 
	log(e);
	throw new Error(e); 
}	
function Right(v) { return v; }
function optional(t){
	var f = function(x) {
		if(x===undefined) {
			return true;
		} else {
			return t(x);
		}
	};
	f.toString = function(){
		return String(t) + "?";
	}
	return f;
}

/*
 * HELPER FUNCTIONS *
                    */

function log() {
	if(!IN_PRODUCTION) {
		var args = ["vablet:"].concat(Array.prototype.slice.call(arguments));
		console.debug.apply(null, args);
	}
}

function getSignature(funcName, funcSpec) {
	var args = funcSpec.link.map(function(arg){
		return arg + "<" + String(funcSpec.in[arg]) + ">";
	}).join(",");
	return funcName + "(" + args + ")";
}

function flatMapPromises(func, xs) {
	if(!Array.isArray(xs)) xs = [xs];

	return Q.allSettled(xs.map(function(x){
		return func(x);
	})).then(function(results){
		return results.filter(function(result){ return result.state === "fulfilled"}) // ignores rejected promises
				.map(function(result){ return result.value });
	});
}

// Check Functions
function stdCheck(response) { 
	if(!!response && response.success===true) {
		return true
	} else {
		return stdErr(response);
	}
}
var alwaysSucceeds = function alwaysSucceeds(x) { return true; }
alwaysSucceeds.__VOID_CALLBACK__ = true; // hacky magic, to deal with api funcs with no callbacks

// Reject Functions

function stdErr(response) { return Left(response.error); };

// Accept Functions
function extract(key) {
	return function(response) {
		if(response[key] !== undefined) { 
			return Right(response[key]);
		} else {
			return Left("Value for key '" + key + "' does not exist, or is undefined.");
		}
	}
}
function nothing(x) { return; }
function everything(x) { return x; }


/* 
 * CALL OBJECTS *
 	 			*/
// Standard Call
function makeCall(funcName, funcArgs, isVoid) {
	return {name: funcName, args: funcArgs, void: !!isVoid};
}
function getCallArgs(call) {
	return call.args;
}
function isVoid(call) {
	return !!call.isVoid;
}

// Mock Call
function makeMockCall(mockValue, timeout) {
	return {isMock: true, mockValue: mockValue, timeout: timeout};
}
function isMockCall(call) {
	return call.isMock || false;
}
function getMockValue(call) {
	if(!isMockCall(call)) return Left(TypeError("Call is not a mock call"));
	return Right(call.mockValue);
}
function getMockTimeout(call) {
	if(!isMockCall(call)) return Left(TypeError("Call is not a mock call"));
	return Right(call.timeout);
}

function getCallName(call) {
	if(isMockCall(call)) {
		return "__MOCK__";
	} else {
		return call.name;
	}
}

/* 
 * API BUILDER *
 			   */
function buildApi(spec, linker, dispatcher) {


	function validateArg(argName, arg, spec) { 
		return spec(arg);
	}

	function validateArgs(funcName, args, spec) {
		var errors = [];

		var allValid = true;
		var argNames = Object.keys(spec.in);

		for(var i=0; i<argNames.length; i++) {
			var argName = argNames[i];
			if(!validateArg(argName, args[argName], spec.in[argName])) {
				errors.push(argName + " expects <" + spec.in[argName] + ">");
				allValid = false;
			}
		}

		if(errors.length) {
			return Left("Argument type error -> " + errors.join("; ") + "\nFunction signature: " + getSignature(funcName, spec));
		} else {
			return Right(allValid);
		}
	}

	function digest(outSpec) {
		return function(response) {
			if (outSpec.check(response)) {
				return outSpec.accept(response);
			} else {
				return outSpec.reject(response);
			}
		}
	}

	function assembleApiCall(funcName, funcSpec, linker, dispatcher) {
		return function(/*args*/){
			var calledArgs = Array.prototype.slice.call(arguments);

			var apiArgs = linker(funcName, calledArgs, funcSpec);
			validateArgs(funcName, apiArgs, funcSpec);

			var apiCall;
			if(this.$$isMocked) {
				apiCall = makeMockCall(this.$$mockValue, this.$$mockTimeout);
			} else {
				apiCall = makeCall(funcName,apiArgs, !!funcSpec.out.check.__VOID_CALLBACK__);
			}

			return dispatcher(apiCall).then(digest(funcSpec.out));
		}
	}

	function validateSpec(funcName, funcSpec) {
		var validSpec = Object.assign(Object.create(null), funcSpec);

		if(validSpec.in === undefined) validSpec.in = Object.create(null);
		if(typeof validSpec.in !== "object")   return Left(funcName + " -> bad spec: 'in' is not an object");

		if(validSpec.out === undefined) validSpec.out = Object.create(null);
		if (typeof validSpec.out !== "object") return Left(funcName + " -> bad spec: 'out' is not an object");
		
		if(validSpec.link === undefined) {
			var args = Object.keys(validSpec.in);
			if(args.length === 0) {
				validSpec.link = [];
			} else if(args.length === 1) {
				validSpec.link = [args[0]]
			} else {
				return Left(funcName + " -> bad spec: missing or un-inferrable link specification");
			}
		}
		if (!Array.isArray(validSpec.link))    return Left(funcName + " -> bad spec: 'link' is not an array");


		// in types
		var argNames = Object.keys(validSpec.in);
		for(var i=0; i<argNames.length; i++) {
			var name = argNames[i];
			if(typeof validSpec.in[name] !== "function") return Left(funcName + " -> bad spec: type specification for argument '" + name + "' is not a function");
		}

		// out defaults
		if(validSpec.out.check === undefined)  validSpec.out.check = stdCheck;
		if(validSpec.out.reject === undefined) validSpec.out.reject = stdErr;
		if(validSpec.out.accept === undefined) validSpec.out.accept = nothing;

		if(typeof validSpec.out.check !== "function")  return Left(funcName + " -> bad spec: out.check is not a function");
		if(typeof validSpec.out.accept !== "function") return Left(funcName + " -> bad spec: out.accept is not a function");
		if(typeof validSpec.out.reject !== "function") return Left(funcName + " -> bad spec: out.reject is not a function");

		return validSpec;
	}

	function assembleApi(apiSpec, linker, dispatcher) {
		apiFunctionNames = Object.keys(apiSpec);
		var assembled = apiFunctionNames.reduce(function(assembledApi, funcName){
			var validSpec = validateSpec(funcName, apiSpec[funcName]);
			assembledApi[funcName] = assembleApiCall(funcName, validSpec, linker, dispatcher);
			return assembledApi;
		}, Object.create(null));

		assembled.registerFunction = function registerFunction(name, func){
			var registered = Object.assign(Object.create(null), this);
			registered[name] = func;
			return Object.freeze(registered);
		}

		assembled.$$isMocked = false;
		assembled.$$mockValue = undefined;
		assembled.$$mockTimeout = undefined;

		assembled.mock = function mock(mockVal,mockTimeout) {
			if(!IN_PRODUCTION) {
				var mocked = Object.assign(Object.create(null), this);
				mocked.$$isMocked = true;
				mocked.$$mockValue = mockVal;
				mocked.$$mockTimeout = mockTimeout;

				return Object.freeze(mocked);
			} else {
				return this;
			}
		}

		assembled.unmock = function unmock() {
			var unmocked = Object.assign(Object.create(null), this);
			unmocked.$$isMocked = false;
			unmocked.$$mockValue = undefined;
			unmocked.$$mockTimeout = undefined;

			return Object.freeze(unmocked);
		}

		assembled.ignoreMock = assembled.unmock;
		assembled.log = log;


		// aliases
		Object.keys(assembled).filter(function(key){
			return key[0] === key[0].toUpperCase();
		}).forEach(function(upperCaseKey){
			var firstLetter = upperCaseKey[0].toLowerCase();
			var rest = upperCaseKey.slice(1);
			var lowerCaseKey = firstLetter + rest;

			if(assembled[lowerCaseKey] === undefined) {
				assembled[lowerCaseKey] = assembled[upperCaseKey];
			}
		});

		return Object.freeze(assembled);

	}

	/////////
	return assembleApi(spec, linker,dispatcher);
	////////
}

// Vablet Dispatch
function vabletDispatch(call) {
	// execute the call
	log("starting call", call);
	var deferred = Q.defer();
	if(isMockCall(call)) {
		try {
			window.setTimeout(function(){
				log("response for", call, "is", getMockValue(call));
				deferred.resolve(getMockValue(call));
			}, getMockTimeout(call));
		} catch(e) {
			log("call", call, "failed with", e);
			deferred.reject(e);
		}
	} else {
		try {
			if(isVoid(call)) {
				VabletNativeInterface.callNativeMethod(getCallName(call), getCallArgs(call), function(){});
				deferred.resolve(undefined);
			} else {
				VabletNativeInterface.callNativeMethod(getCallName(call), getCallArgs(call), function(response){
					log("response for ", call, " is ", response);
					deferred.resolve(response);
				});
			}
		} catch(e) {
			log("call", call, "failed with", e);
			deferred.reject(e);
		}
	}

	return deferred.promise;
}

// Array linker
function arrayLinker(funcName, args, apiFuncSpec) {

	if(args.length!==apiFuncSpec.link.length) { return Left("Missing arguments in " + funcName + ". Signature: " + getSignature(funcName, apiFuncSpec)) }
	
	var apiArgs = Object.create(null);
	for(var i=0; i<args.length; i++) {
		if(args[i] !== undefined) {
			apiArgs[apiFuncSpec.link[i]] = args[i];
		}
	}

	return Right(apiArgs);
}


// Object linker
function objectLink(funcName, args, apiFuncSpec) {
	if(!args) { return Left("Missing arguments object"); }

	var argsObj = args[0];

	var apiArgs = Object.create(null);
	Object.keys(apiFuncSpec.in).reduce(function(func){
		apiArgs[func] = argsObj[func];
	});

	return Right(apiArgs);
}

/* Vablet API Spec */

var vabletSpec = {
	addFileIdsToUserFolder: {
		in: {
			folderName: types.string,
			fileIdArray: types.numberOrString,
		},
		link: ['folderName', 'fileIdArray']
	},
	addFileNamesToUserFolder: {
		in: {
			folderName: types.string,
			fileNameArray: types.arrayOf(types.string)
		},
		link: ['folderName', 'fileNameArray']
	},
	changeActiveFolderTo: {
		in: {
			folderName: types.string
		}
	},
	closeFile: {
		in: {
			fileId: types.numberOrString
		}
	},
	ConvertHTMLAttachmentToPdfAndSend: {
		in: {
			to: types.arrayOf(types.string),
			cc: optional(types.arrayOf(types.string)),
			bcc: optional(types.arrayOf(types.string)),
			body: types.string,
			company: types.string,
			subject: types.string,
			queueIfNotAbleToSend: types.boolean,
			pdfPageSize: types.objectOf({width: types.numberOrString, height: types.numberOrString}),
			attachmentDataBase64Encoded: types.string,
			attachmentName: types.string
		},
		link: ['to', 'cc', 'bcc', 'body', 'company', 'subject', 'queueIfNotAbleToSend', 'pdfPageSize', 'attachmentDataBase64Encoded', 'attachmentName']
	},
	createUserFolder: {
		in: {
			folderName: types.string
		}
	},
	enableNativeDisplayOfHtmlSelectionForHTMLPaths: {
		in: {
			htmlPaths: types.arrayOf(types.string)
		}
	},
	endSession: {},
	getFileWithId: {
		in: {
			fildId: types.numberOrString
		},
		out: {
			accept: extract('file')
		}
	},
	getFolderFullDataById: {
		in: {
			folderId: types.numberOrString
		},
		out: {
			accept: extract('folderData')
		}
	},
	getFolderFullDataByPath: {
		in: {
			folderPath: types.string
		},
		out: {
			accept: extract('folderData')
		}
	},
	getLatestManifest: {},
	GetSalesForceContact: {
		in: {
			contactId: types.numberOrString
		},
		out: {
			accept: everything
		}
	},
	getSalesforceContactIfEnabledElseNative: {
		out: {
			accept: everything
		}
	},
	GetSelectedContactsIndependentOfSessionType: {
		out: {
			accept: extract('typeIndependentContacts')
		}
	},
	getThumbnailForFileId: {
		in: {
			fileId: types.numberOrString
		},
		out: {
			accept: extract('base64EncodedJpeg')
		}
	},
	getXMLForFileId: {
		in: {
			fileId: types.numberOrString
		},
		out: {
			accept: everything
		}
	},
	getXMLForFileName: {
		in: {
			fileName: types.string
		},
		out: {
			accept: everything
		}
	},
	HideCloseButton: {
		in: {
			fileId: types.numberOrString
		},
		out: {
			check: alwaysSucceeds
		}
	},
	hideHtmlSelection: {},
	presentSalesforceCalendar: {},
	presentSalesforceMenuFromButtonWithId: {
		in: {
			buttonId: types.numberOrString
		}
	},
	reportPageChange: {
		in: {
			newPage: types.numberOrString
		},
		out: {
			check: alwaysSucceeds
		}
	},
	searchForTerm: {
		in: {
			enableLiveUpdates: optional(types.boolean),
			searchForTerm: types.string
		},
		out: {
			accept: extract('files')
		},
		link: ['searchForTerm', 'enableLiveUpdates']
	},
	SendEmail: {
		in: {
			to: types.arrayOf(types.string),
			cc: optional(types.arrayOf(types.string)),
			bcc: optional(types.arrayOf(types.string)),
			body: types.string,
			company: types.string,
			subject: types.string,
			queueIfNotAbleToSend: types.boolean,
			attachmentDataBase64Encoded: types.string,
			attachmentName: types.string,
			disableEmailTemplate: types.boolean,
			disableAttachment: types.boolean
		},
		link: [
			'to','cc','bcc','body','company','subject'
			,'queueIfNotAbleToSend','disableEmailTemplate','disableAttachment'
			,'attachmentName','attachmentDataBase64Encoded'
		]
	},
	sendEmailForFiles: {
		in: {
			to: types.arrayOf(types.objectOf({name: types.string, email: types.string})),
			cc: optional(types.arrayOf(types.string)),
			bcc: optional(types.arrayOf(types.string)),
			fileIds: types.arrayOf(types.numberOrString),
			body: types.string,
			company: types.string,
			subject: types.string,
			includeAnnotation: types.boolean,
			sendAsLink: types.boolean,
			sendAsAttachment: types.boolean,
			compressOutputAtNumberOfBytes: types.valueOf(-1)
		},
		link: [
			'to','cc','bcc','fileIds','body','company','subject','includeAnnotation',
			'sendAsLink','sendAsAttachment','compressOutputAtNumberOfBytes'
		]
	},
	setCompletedToTrue: {
		in: {
			fileId: types.numberOrString
		},
		out: {
			check: alwaysSucceeds
		}
	},
	showHtmlSelectionForHTMLPaths: {
		in: {
			htmlPaths: types.arrayOf(types.string)
		}
	},
	snapshotCurrentPage: {
		in: {
			pageName: types.string
		},
		out: {
			check: alwaysSucceeds
		}
	},
	startSessionWithSalesforceContactId: {
		in: {
			contactId: types.numberOrString
		}
	},
	startSessionWithoutContact: {},
	SupressFileToolbar: {
		in: {
			fileId: types.numberOrString
		},
		out: {
			check: alwaysSucceeds
		}
	},
	toggleFavoriteStatusForFileWithId: {
		in: {
			fileId: types.numberOrString
		}
	},
	toggleTagStatusForFileWithId: {
		in: {
			fileId: types.numberOrString
		}
	},
	useVabletGUIToSendEmailForFiles: {
		in: {
			fileIds: types.arrayOf(types.numberOrString),
			to: types.arrayOf(types.objectOf({name: types.string, email: types.string})),
			cc: optional(types.arrayOf(types.string)),
			bcc: optional(types.arrayOf(types.string)),
			body: types.string,
			subject: types.string
		},
		link: ['fileIds', 'to', 'bcc', 'cc', 'body', 'subject']
	},
	//////// Un-documented, but still used in production ... ?
	GetInfoManifest: {
		out: {
			accept: extract('infoManifest')
		}
	},
	GetSalesForceSelectedContacts: {
		out: {
			accept: extract('contacts')
		}
	}
/* 
	// Example with all all defaults
	example:
		{
			in: {
				arg2: types.number,
				arg1: optional(types.arrayOf(types.string)),
			},
			out: {
				check: stdCheck,
				reject: stdErr,
				accept: extract('keyName')
			},
			link: ['arg1','arg2']
		}
*/
}

var vablet = buildApi(vabletSpec,arrayLinker,vabletDispatch)
	.registerFunction('getIdForFileName', function(fileName){
		var vablet = this;
		function searchForOne(fileName) {
			return vablet.searchForTerm(fileName, false).then(function(files){
				var exactMatches = files.filter(function(file){
					return file.title === fileName;
				});

				if(!exactMatches.length) {
					throw new Error("No matches for " + fileName);
				} else {
					return exactMatches[0].fileId;
				}
			});
		}

		return flatMapPromises(searchForOne, fileName);
	})
	.registerFunction('getFileNameForId', function(fileId){
		var vablet = this;
		function searchForOne(fileId) {
			return vablet.getFileWithId(fileId).then(function(file){
				return file.title;
			});
		}
		return flatMapPromises(searchForOne, fileId);
	})
	.registerFunction('loadHCPInfo', function(){
		var vablet = this;
		return vablet.GetSalesForceSelectedContacts().then(function(contacts){
			var firstContact = contacts[0];
			return {
				firstName: firstContact.FirstName,
				lastName: firstContact.LastName,
				email: firstContact.Email
			}
		});
	})
	.registerFunction('loadSalesRepInfo', function(){
		var vablet = this;
		return vablet.GetInfoManifest().then(function(infoManifest){
			return {
				firstName: infoManifest.FirstName,
				lastName: infoManifest.LastName,
				email: infoManifest.Email
			}
		});
	})
	.registerFunction('email', function(message, config){
		var vablet = this;
		config = config || {};

		var address = {
			address: function(email, name) {
					name = name? name : email;
					return {email: email, name: name};
			},
			addressList: function(xs) {
				if(!xs) return [];
				if(arguments.length > 1) xs = Array.prototype.slice.call(arguments);
				if(!Array.isArray(xs)) xs = [xs];

				var makeAddress = this.address;
				return xs.map(function(x){
					if(typeof x === 'string') {
						return makeAddress(x,x);
					} else {
						return makeAddress(x.email, x.name);
					}
				});
			},
			emailList: function(xs) {
				if(!xs) return [];
				if(arguments.length > 1) xs = Array.prototype.slice.call(arguments);
				if(!Array.isArray(xs)) xs = [xs];

				return xs.map(function(x){
					if(typeof x === 'string') {
						return x;
					} else {
						return x.email;
					}
				})
			}
		};

		if(message.attachments) {
			var args = [
				address.addressList(message.to),
				address.emailList(message.cc),
				address.emailList(message.bcc),
				message.attachments,
				message.body,
				config.company || '',
				message.subject,
				config.includeAnnotation || false,
				config.sendAsLink || true,
				config.sendAsAttachment || false,
				-1 // un-implemented compressOutputAtNumberOfBytes, -1 required
			];
			return vablet.sendEmailForFiles.apply(vablet, args);
		} else {
			var args = [
				address.emailList(message.to),
				address.emailList(message.cc),
				address.emailList(message.bcc),
				message.body,
				config.company,
				message.subject,
				config.queueIfNotAbleToSend || true,
				config.attachmentDataBase64Encoded,
				config.attachmentName,
				config.disableEmailTemplate || true,
				config.disableAttachment || true
			];
			return vablet.SendEmail.apply(vablet, args);
		}
	});

return vablet;
});
