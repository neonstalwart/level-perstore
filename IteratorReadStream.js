// borrows heavily from q-io Copyright 2009–2013 Kristopher Michael Kowal MIT License
var Q = require('q');

module.exports = Reader;

function Reader(db, iterOptions) {
	var chunks = [],
		begin = Q.defer(),
		end = Q.defer(),
		stream = {
			forEach: forEach,
			close: close
		},
		receiver,
		iterator;

	end.promise.then(function () {
		Q.ninvoke(iterator, 'end');
	});

	db.open(ready);

	return begin.promise;

	function ready() {
		iterator = db.db.iterator(iterOptions);
		begin.resolve(stream);
	}

	function slurp() {
		if (receiver) {
			chunks.forEach(receiver);
			chunks.splice(0, chunks.length);
		}

		iterator.next(function (err, key, value) {
			if (err) {
				return end.reject(err);
			}

			if (key === undefined && value === undefined) {
				return end.resolve();
			}

			chunks.push({
				key: db._codec.decodeKey(key, db.options),
				value: db._codec.decodeValue(value, db.options)
			});
			slurp();
		});
	}

	function forEach(write) {
		receiver = write;
		slurp();
		return end.promise.then(function () {
			receiver = undefined;
		});
	}

	function close() {
		end.resolve();
	}
}
