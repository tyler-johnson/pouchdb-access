// rollup replaces lodash references with lodash.isArray or mangles var names
// CouchDB needs isArray variable exactly, this fixs that
const isArray = Array.isArray;

// a couchdb design doc function for checking if a user has access given a security context.
export default function hasAccess(secObj, userCtx) {
	if (secObj.toJSON) secObj = secObj.toJSON();

	userCtx = userCtx || {};

	// see if the username is in names list
	if (secObj && isArray(secObj.names)) {
		if (secObj.names.indexOf(userCtx.name) !== -1) {
			return true;
		}
	}

	// see if overlap of roles
	if (secObj && isArray(secObj.roles) && isArray(userCtx.roles)) {
		for (var idx = 0; idx < userCtx.roles.length; idx++) {
			if (secObj.roles.indexOf(userCtx.roles[idx]) !== -1) return true;
		}
	}

	return false;
}
