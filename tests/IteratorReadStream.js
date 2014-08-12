define(function (require) {
	var test = require('intern!object'),
		assert = require('intern/chai!assert'),
		Q = require('dojo/node!q'),
		Stream = require('dojo/node!../IteratorReadStream'),
		dbUtil = require('./util/db'),
		data = [
			{ id: 1, value: 'one' },
			{ id: 2, value: 'two' },
			{ id: 3, value: 'three' }
		],
		db,
		reader,
		stream;

	test({
		name: 'IteratorReadStream API',

		before: function () {
			return dbUtil.destroy();
		},

		beforeEach: function () {
			db = dbUtil.create();
			reader = new Stream(db);
			return reader.then(function (_stream) {
				stream = _stream;
				return Q.all(data.map(function (item) {
					return Q.ninvoke(db, 'put', item.id, item);
				}));
			});
		},

		afterEach: function () {
			return Q.ninvoke(db, 'close').then(function () {
				return dbUtil.destroy();
			});
		},

		constructor: {
			'is a function': function () {
				assert.isFunction (Stream, 'IteratorReadStream is a function');
			},

			'requires a database': function () {
				assert.throws(function () {
					return new Stream();
				});
			},

			'returns a promise': function () {
				assert.isFunction (reader.then, 'stream is a promise');
			},

			'promise resolves to a forEachable stream': function () {
				return reader.then(function (stream) {
					assert.isFunction(stream.forEach, 'resolved stream is a forEachable');
				});
			}
		},

		'forEach iterates over all values in the db': function () {
			var items = [];

			return stream.forEach(function (item) {
				var value = item.value;

				assert.include(data, value, 'items should be included in data');
				items.push(value);
			})
			.then(function () {
				assert.strictEqual(items.length, data.length, 'all items should be iterated');
			});
		},

		'close will stop the stream': function () {
			var items = [];

			return stream.forEach(function (item) {
				var value = item.value;

				assert.include(data, value, 'items should be included in data');
				items.push(value);

				stream.close();
			})
			.then(function () {
				assert.strictEqual(items.length, 1, 'close should stop the stream');
			});
		}
	});
});
