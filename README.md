# level-perstore

A [perstore](https://github.com/persvr/perstore) interface that persists data using
[LevelDB](https://github.com/rvagg/node-levelup).

# Example

```js
var LevelUp = require('levelup'),
	Sublevel = require('level-sublevel'),
	Store = require('level-perstore'),
	db = SubLevel(LevelUp('./db')),
	userDb = db('user'),
	userStore = Store({
		db: userDb
	});

// TODO: show some store interaction
```

# Methods

TODO: list the methods

# Install

With [npm](https://npmjs.org/package/npm) do:

```sh
npm install level-perstore
```

# License

[New BSD License](LICENSE). All code is developed under the terms of the [Dojo Foundation CLA](http://dojofoundation.org/about/cla).

© 2014 Ben Hockey
