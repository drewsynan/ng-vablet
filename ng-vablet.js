(function (definition) {
    
    // angularJS
    if (typeof angular === "object") {
    	angular.module('ngVablet', [])
    		   .provider('vablet-dev', function(){
    		   		this.$get = function($q){
    		   			return definition($q);
    		   		}
    		   })
    		   .provider('vablet', function(){
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
        	vablet = definition(Q);
        } else {
        	throw new Error("Vablet: Could not find Q library");
        }
    }
})(function (Q, IN_PRODUCTION) {
'use strict';

IN_PRODUCTION = IN_PRODUCTION || false;

var vablet = (function(){

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

	types.vablet = {
		email: types.objectOf({name: types.string, email: types.string}),
		numberOrString: (function(){
			var f = function(x) { return types.string(x) || types.number(x); };
			f.toString = function numberOrString() { return "number or string"; }
			return f;
		}())
	}

	function arg(name, type, required) {
		if(required === undefined) required = true; // default is required
		type = type || types.any;

		return {name: name, type: type, required: required}
	}

	var vabletApi = {
		addFileIdsToUserFolder: 
			[
				arg('folderName',			types.string),
				arg('fileIdArray',			types.arrayOf(types.vablet.numberOrString)),
			],
		addFileNamesToUserFolder: 
			[
				arg('folderName',			types.string),
				arg('fileNameArray',		types.arrayOf(types.string))

			],
		changeActiveFolderTo: 
			[
				arg('folderName',			types.string)
			],
		CloseFile:
			[
				arg('fileId',				types.vablet.numberOrString)
			],
		ConvertHTMLAttachmentToPdfAndSend: 
			[
				arg('to',					types.arrayOf(types.string)),
				arg('cc',					types.string, false),
				arg('bcc',					types.string, false),
				arg('company',				types.string, false),
				arg('subject',				types.string),
				arg('queueIfNotAbleToSend', types.boolean),
				arg('pdfPageSize',			types.objectOf({width: types.vablet.numberOrString, height: types.vablet.numberOrString}), true),
				arg('attachmentDataBase64Encoded', types.boolean),
				arg('attachmentName',		types.string)
			],
		createUserFolder: 
			[
				arg('folderName',			types.string)
			],
		enableNativeDisplayOfHtmlSelectionForHTMLPaths: 
			[
				arg('htmlPaths', 			types.string)
			],
		endSession: 
			[],
		getFileWithId: 
			[
				arg('fileId', 				types.vablet.numberOrString)
			],
		getFolderFullDataById: 
			[
				arg('folderId', 			types.vablet.numberOrString)
			],
		getFolderFullDataByPath: 
			[
				arg('folderPath', 			types.string)
			],
		getLatestManifest: 
			[],
		GetInfoManifest:
			[], /// deprecated ???
		GetSalesForceContact: 
			[ // ??? deprecated ???
				arg('fileId', 				types.vablet.numberOrString)
			],
		GetSalesForceSelectedContacts: 
			[],
		getSalesforceContactIfEnabledElseNative: 
			[],
		GetSelectedContactsIndependentOfSessionType: 
			[],
		getThumbnailForFileId: 
			[
				arg('fileId',				types.vablet.numberOrString)
			],
		getXMLForFileId: 
			[
				arg('fileId',				types.vablet.numberOrString)
			],
		getXMLForFileName: 
			[
				arg('fileName',				types.string)
			],
		HideCloseButton: 
			[
				arg('fileId',				types.vablet.numberOrString)
			],
		hideHtmlSelection: 
			[],
		presentSalesforceCalendar: 
			[],
		presentSalesforceMenuFromButtonWithId: 
			[
				arg('buttonId',				types.vablet.numberOrString)
			],
		reportPageChange: 
			[
				arg('newPage',				types.number)
			],
		searchForTerm: 
			[
				arg('searchTerm',			types.string),
				arg('enableLiveUpdates',	types.boolean)
			],
		SendEmail: 
			[
				arg('to',					types.arrayOf(types.string)),
				arg('cc',					types.arrayOf(types.string)),
				arg('bcc',					types.arrayOf(types.string)),
				arg('body',					types.string),
				arg('company',				types.string, false),
				arg('subject',				types.string),
				arg('queueIfNotAbleToSend', types.boolean),
				arg('attachmentDataBase64Encoded', types.boolean, false),
				arg('attachmentName', 		types.string, false),
				arg('disableEmailTemplate', types.boolean, false),
				arg('disableAttachment', 	types.boolean, false)
			],
		sendEmailForFiles: 
			[
				arg('to',					types.arrayOf(types.vablet.email)),
				arg('cc', 					types.arrayOf(types.string), false),
				arg('bcc',					types.arrayOf(types.string), false),
				arg('fileIds',				types.arrayOf(types.vablet.numberOrString)),
				arg('body',					types.string),
				arg('company',				types.string, false),
				arg('subject',				types.string),
				arg('includeAnnotation', 	types.boolean,	false),
				arg('sendAsLink', 			types.boolean, false),
				arg('sendAsAttachment', 	types.boolean,	false),
				arg('compressOutputAtNumberOfBytes', types.valueOf(-1)),
			],
		setCompletedToTrue: 
			[
				arg('fileId',				types.vablet.numberOrString)
			],
		showHtmlSelectionForHTMLPaths: 
			[
				arg('htmlPaths',			types.string)
			],
		snapshotCurrentPage: 
			[
				arg('pageName',				types.string)
			],
		startSessionWithSalesforceContactId: [
				arg('contactId', 			types.vablet.numberOrString)
			],
		startSessionWithoutContact: 
			[],
		SupressFileToolbar: 
			[
				arg('fileId', 				types.vablet.numberOrString)
			],
		toggleFavoriteStatusForFileWithId: 
			[
				arg('fileId', 				types.vablet.numberOrString)
			],
		toggleTagStatusForFileWithId:
			[
				arg('fileId', 				types.vablet.numberOrString)
			],
		useVabletGUIToSendEmailForFiles:
			[
				arg('to', 					types.arrayOf(types.vablet.email)),
				arg('cc', 					types.arrayOf(types.string), false),
				arg('bcc',					types.arrayOf(types.string), false),
				arg('fildIds',				types.arrayOf(types.vablet.numberOrString)),
				arg('body',					types.string),
				arg('subject',				types.string)
			]
	};

	function _emptyObject(){
		if(Object.create) {
			return Object.create(null);
		} else {
			return {};
		}
	}

	var MOCK_CALL = "mock_call";

	function makeCall(func, args) {
		return {func: func, args: args}
	}

	function executeCall(call) {
		var deferred = Q.defer();
		// console.log(call.func, call.args);

		if(call.func === MOCK_CALL) {
			window.setTimeout(function(){
				if(call.args.mockVal.success || call.args.mockVal.success === undefined) {
					deferred.resolve(call.args.mockVal);
				} else {
					deferred.reject(call.args.mockVal.error);
				}
			}, call.args.mockTimeout);
		} else {
			try {
				VabletNativeInterface.callNativeMethod(call.func, call.args, function(response){
					if(response.success) {
						deferred.resolve(response);
					} else {
						deferred.reject(response.error);
					}
				});
			} catch(e) {
				deferred.reject(e);
			}
		}

		return deferred.promise;
	}

	function makeApi(apiDescription) {
		var apiFunctions = Object.keys(apiDescription);

		var constructedApi = apiFunctions.reduce(function(api, apiFunction){
			api[apiFunction] = function() {
				var namedArgs = apiDescription[apiFunction];
				var calledArgs = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
				var apiCallArgs = _emptyObject();

				if (namedArgs.length !== calledArgs.length) {
					var argList = namedArgs.map(function(a){ 
						var required = a.required ? "" : "?";
						return a.name + required + "<" + a.type + ">"; 
					}).join(",");
					throw new Error("Wrong # of args. Signature: " + apiFunction + "(" + argList +  ")");
				} else {
					for(var i=0; i<namedArgs.length; i++) {
						if(namedArgs[i].required || calledArgs[i] !== undefined) {
							if(namedArgs[i].type(calledArgs[i])) {
								apiCallArgs[namedArgs[i].name] = calledArgs[i];
							} else {
								throw new TypeError(apiFunction + ": parameter " + namedArgs[i].name + " expects " + namedArgs[i].type);
							}
						}
					}
				}

				return makeCall(apiFunction,apiCallArgs);
			}
			return api;
		}, _emptyObject());

		constructedApi.mock = function mock(mockVal, mockTimeout) {
			if (!IN_PRODUCTION) {
				var mockedApi = this; //makeApi(apiDescription);
				var wrapper = _emptyObject();

				Object.keys(mockedApi).forEach(function(funcName){
					wrapper[funcName] = function(){
						mockedApi[funcName].apply(null, arguments); // throws
						return makeCall(MOCK_CALL, {mockVal: mockVal, mockTimeout: mockTimeout});
					}
				});

				wrapper.mock = this.mock; // override wrapped function for mock

				return wrapper;
			} else {
				return this;
			}
		}

		return constructedApi;
	}

	function blankAPI(){
		var initial = _emptyObject();
		initial.$api = Object.freeze(makeApi(vabletApi));
		initial.$registered = _emptyObject();
		initial.registerFunction = function(name, func) {
				if(typeof func !== "function") {
					throw new TypeError("func must be a function");
				}

				var o = _emptyObject();
				o[name] = function() { return func.apply(this, arguments); };
				Object.assign(this, o);
				Object.assign(this.$registered, o);

				return this;
		};

		Object.keys(initial.$api).forEach(function(func){
			var o = _emptyObject();
			o[func] = function(){
				var call = initial.$api[func].apply(null, arguments); // ? built-ins don't use 'this' yet...
				return executeCall(call);
			}
			Object.assign(initial, o);
		});

		return initial;
	}

	var wrapped = blankAPI();
	wrapped.mock = function(){
		if(!IN_PRODUCTION) {
			var mockedApi = blankAPI();
			Object.assign(mockedApi, this.$registered);
			Object.assign(mockedApi.$registered, this.$registered);

			mockedApi.$api = this.$api.mock.apply(this.$api, arguments);

			// "special" functions that don't need the executor, or to be wrapped
			mockedApi.mock = this.mock;
			mockedApi.registerFunction = this.registerFunction;

			return mockedApi;
		} else {
			return this;
		}
	}

	return wrapped;

}()).registerFunction('getIdForFileName', function(fileName) {
	var vablet = this;

	function searchForOne(fileName) {
		return vablet.searchForTerm(fileName, false).then(function(found){
			var files = found.files;
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

	return flatMap(searchForOne, fileName);

}).registerFunction('getFileNameForId', function(fileId){
	var vablet = this;
	function searchForOne(fileId) {
		return vablet.getFileWithId(fileId).then(function(found){
			return found.file.title;
		});
	}
	return flatMap(searchForOne, fileId);

}).registerFunction('loadHCPInfo', function(){
	return this.GetSalesForceSelectedContacts().then(function(response){
		if(response.contacts) {
			var firstContact = response.contacts[0];
			return {
				firstName: firstContact.FirstName,
				lastName: firstContact.LastName,
				email: firstContact.Email
			}
		}
	});

}).registerFunction('loadSalesRepInfo', function(){
	return this.GetInfoManifest().then(function(manifest){
		return {
			firstName: manifest.infoManifest.FirstName,
			lastName: manifest.infoManifest.LastName,
			email: manifest.infoManifest.Email
		}
	});
});

function flatMap(func, xs) {
	if(!Array.isArray(xs)) xs = [xs];

	return Q.allSettled(xs.map(function(x){
		return func(x);
	})).then(function(results){
		return results.filter(function(result){ return result.state === "fulfilled"})
				.map(function(result){ return result.value });
	});
}

var address = {
	address: function(email, name) {
			name = name? name : email;
			return {email: email, name: name};
	},
	addressList: function(xs) {
		if(!xs) return [];
		if(arguments.length > 1) xs = Array.apply(null, arguments);
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
		if(arguments.length > 1) xs = Array.apply(null, arguments);
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
vablet.registerFunction('email', function(message, config){
	config = config || {};

	if(message.attachments) {
		var args = [
			address.addressList(message.to),
			address.emailList(message.cc),
			address.emailList(message.bcc),
			message.attachments,
			message.body,
			config.company,
			message.subject,
			config.includeAnnotation || false,
			config.sendAsLink || true,
			config.sendAsAttachment || false,
			-1 // un-implemented compressOutputAtNumberOfBytes, -1 required
		];
		return this.sendEmailForFiles.apply(this, args);
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
		return this.SendEmail.apply(this, args);
	}
});

return vablet;

});
