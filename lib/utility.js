module.exports.unempty =
function unempty(o, deleteKeys) {
	if ( Array.isArray(o) || typeof o == 'object' ) {
		for ( key in o ) {
			if ( deleteKeys && deleteKeys.indexOf(key) >= 0 ) {
				delete o[key];
				continue;
			}
			// only recursively unempty arrays and objects
			if ( Array.isArray(o[key]) || typeof o[key] == 'object' )
				o[key] = unempty(o[key], deleteKeys);
			// If it's falsy (but not 0), or an empty object/array, delete it
			if (
				o[key] === null || o[key] === false || o[key] === ''
				|| ( Array.isArray(o[key]) && o[key].length === 0 )
				|| ( typeof o[key] === 'object' && Object.keys(o[key]).length === 0 )
			) {
				delete o[key];
			}
		}
	}
	return o;
}
