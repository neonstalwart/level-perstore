module.exports = Store;

var Q = require('q'),
	create = require('level-create');

function Store(options) {
	if (!options || !options.db) {
		throw new ReferenceError('A db must be provided to create a new level-perstore');
	}

	if (!(this instanceof Store)) {
		return new Store(options);
	}

	this.db = options.db;
}

Store.prototype = {
	constructor: Store,

	idProperty: 'id',

	getIdentity: function (value) {
		return value[ this.idProperty ];
	},

	get: function (id) {
		return Q.ninvoke(this.db, 'get', id).catch(function (err) {
			// notFound is not something to be considered an error in perstore
			if (err.notFound) {
				return;
			}
			throw err;
		});
	},

	put: function (value, options) {
		options = options || {};

		var dbOptions = {},
			key = 'id' in options ? value[ this.idProperty ] = options.id : this.getIdentity(value),
			db = this.db;

		dbOptions.sync = options.sync;

		return options.overwrite === false ?
			// TODO: include dbOptions after https://github.com/substack/level-create/issues/1 is addressed
			// fail if a value alread exists at the key
			Q.nfcall(create, db, key, value) :
			// unconditionally write the value to the key
			Q.ninvoke(db, 'put', key, value, dbOptions);
	}
};
