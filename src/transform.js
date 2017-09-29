import {forEach,isFunction} from "lodash";
import {EventEmitter} from "events";
import Operations from "./operations";
import normalize from "./normalize";

export default class Transform extends EventEmitter {
	constructor(access, opts = {}) {
		super();

		this.access = access;
		this.sync = opts.sync || access.sync;
		this.options = opts;
		this.operations = [];
	}

  addLevel(name, before) {
		if (Array.isArray(name)) {
			name.forEach((n) => this.addLevel(n, before));
			return this;
		}

		if (typeof name !== "string" || name === "") {
			throw new Error("Expecting string for level name.");
		}

		this.push("add", "level", {
			name: name,
			before: typeof before === "string" && before ? before : null
		});

		return this;
	}

	removeLevel(name) {
		if (Array.isArray(name)) {
			name.forEach((n) => this.removeLevel(n));
			return this;
		}

		if (typeof name !== "string" || name === "") {
			throw new Error("Expecting string for level name.");
		}

		this.push("add", "level", { name: name });
		return this;
	}

	setLevel(list, item, level) {
		if (list !== "names" && list !== "roles") {
			throw new Error("Expecting 'names' or 'roles' for list name.");
		}

		if (Array.isArray(item)) {
			item.forEach((i) => this.setLevel(list, i, level));
			return this;
		}

		if (typeof item === "object" && item != null && level == null) {
			forEach(item, (r, i) => this.setLevel(list, i, r));
			return this;
		}

		var action;
		var op = {
			list: list,
			item: item
		};

		if (level) {
			action = "add";
			op.level = level;
		} else {
			action = "remove";
		}

		this.push(action, "member", op);
		return this;
	}

	setNameLevel(name, level) {
		return this.setLevel("names", name, level);
	}

	setRoleLevel(role, level) {
		return this.setLevel("roles", role, level);
	}

  setPrivate() {
		this.push("add", "private");
		return this;
	}

	setPublic() {
		this.push("remove", "private");
		return this;
	}

	filter(name, fn) {
		if (typeof name !== "string" || name === "") {
			throw new Error("Expecting non-empty string for validation name.");
		}

		fn = normalize(fn);
		this.push(fn ? "add" : "remove", "filter", { name, fn });
		return this;
	}

	validate(name, fn) {
		if (typeof name !== "string" || name === "") {
			throw new Error("Expecting non-empty string for validation name.");
		}

		fn = normalize(fn);
		this.push(fn ? "add" : "remove", "validate", { name, fn });
		return this;
	}

	push(optype, type, value) {
		// make op object
		let op = {
			op: optype,
			type: type,
			value: value || {}
		};

		// push the operation
		this.operations.push(op);

		// play operation on local data
		try {
			this.emit("pre", op);
			this._play(op);
			this.emit("post", op);
		}

		// if there's an error applying, undo the operation
		catch(e) {
			this.operations.pop();
			throw e;
		}

		return this;
	}

	// plays local operations on local data
	// this method is idempotent and can be run any number of times with no change in data
	_replay() {
		this._play(this.operations);
	}

	_play(op) {
		// loop through operations
		if (Array.isArray(op)) {
			op.forEach((o) => this._play(o, true));
		}

		// only apply datacore operations
		else {
			Transform.play(null, this.access.design, op);
		}
	}

  static play(security, design, op) {
		if (Array.isArray(op)) {
			op.forEach((o) => Transform.play(security, design, o));
			return;
		}

		let optype = op.op.toLowerCase();
		if (optype !== "add" && optype !== "remove") {
			throw new Error("Expecting 'add' or 'remove' for operation.");
		}

		let player = Operations[op.type];
		if (isFunction(player[optype])) player[optype](security, design, op.value);
		else if (isFunction(player)) player(optype, security, design, op.value);
	}

  _defer() {
    let save = this._deferral;

    if (!save) {
      save = this._deferral = {};
      let clean = () => delete this._deferral;
      save.promise = new Promise((resolve, reject) => {
        save.resolve = resolve;
        save.reject = reject;
      }).then(clean, (e) => {
        clean();
        throw e;
      });
    }

    return save.promise;
  }

  saving() {
    return this._saving;
  }

  delayedSave(ms) {
    let p = this._defer();

    if (!this._deferral.timeout) {
      this._deferral.timeout = setTimeout(this.save.bind(this), ms);
    }

    return p;
  }

  save() {
    let p = this._defer();

    // return if already saving
    if (this._saving) return p;
    this._saving = true;
    let clean = () => delete this._saving;

    // clear timeout
    if (this._deferral.timeout) {
      clearTimeout(this._deferral.timeout);
      delete this._deferral.timeout;
    }

    // save
    this._save().then(() => {
      clean();
      this._deferral.resolve();
    }, (e) => {
      clean();
      this._deferral.reject(e);
    });

    // return a deferred promise
    return p;
  }

  _save() {
    let ops;
    this.emit("save");

    return Promise.resolve().then(() => {
      // immediately copy and remove operations from stack
      ops = this.operations.splice(0, this.operations.length);

      // if there are no operations, we don't need to be here
      if (!ops.length) return;

      // otherwise call sync method
      return this.sync.call(this.access, ops);
    })

    // handle errors
    .catch((e) => {
      // if an error occurs, shove the operations back on the front of the stack
      // since operations are idempotent, it is okay to rerun them in the event of a failure
      if (ops) {
        this.operations.unshift.apply(this.operations, ops);
        this._replay();
      }

      throw e;
    });
  }
}
