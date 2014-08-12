define(function (require) {
	var Q = require('dojo/node!q'),
		LevelUp = require('dojo/node!levelup'),
		LevelDown = require('dojo/node!leveldown'),
		dbLocation = './tests/db';

	return {
		create: create,
		destroy: Q.nbind(LevelDown.destroy, LevelDown, dbLocation)
	};

	function create(options) {
		options = options || {};
		options.keyEncoding = options.keyEncoding || 'json';
		options.valueEncoding = options.valueEncoding || 'json';

		return new LevelUp('./tests/db', options);
	}
});
