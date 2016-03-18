import Design from "./design";
import Operations from "./operations";
import securityPlugin from "pouchdb-security-helper";
import {isArray,forEach,isFunction,isEqual} from "lodash";
import hasAccess from "./has-access";
import {getLevel,hasLevel} from "./levels.js";

const {Security} = securityPlugin;

export default class Access {
	constructor(db, design) {
		if (db instanceof Access) {
			design = db.toDesign();
			db = db.database;
		}

		// list of write operations on the design
		this.operations = [];
		// are we talking directly to CouchDB?
		// this dictates whether or not we can write the access document
		this.remote = db && db.adapter === "http";
		// db to get and put with
		this.database = db;
		// set the current design
		this.setDesign(design);
	}

	clone() {
		return new Access(this);
	}

	_getSecurity() {
		if (!this.remote) return Promise.resolve(new Security());
		let sec = new Security(this.database);
		return sec.fetch().then(() => sec);
	}

	_getDesign() {
		return this.database.get("_design/access").catch((e) => {
			if (e.status !== 404) throw e;
		}).then((doc) => {
			return Design.parse(doc);
		});
	}

	_reset(design) {
		this.design = design;
		this._replay();
	}

	setDesign(doc) {
		if (doc instanceof Access) doc = doc.toDesign();
		this._reset(Design.parse(doc));
		return this;
	}

	fetch() {
		return this._getDesign().then((d) => this._reset(d));
	}

	addLevel(name, before) {
		if (isArray(name)) {
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
		if (isArray(name)) {
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

		if (isArray(item)) {
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

	getLevel(userCtx) {
		return getLevel(this.design.levels, userCtx);
	}

	hasLevel(userCtx, level) {
		return hasLevel(this.design.levels, userCtx, level);
	}

	get levels() { return this.design.levels; }

	get private() {
		return this.design.private;
	}

	get public() {
		return !this.design.private;
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

		// write mode
		if (arguments.length > 1) {
			if (typeof fn === "function") fn = fn.toString();
			this.push(fn ? "add" : "remove", "filter", { name, fn });
			return this;
		}

		// read mode
		return this.design.filters[name];
	}

	validate(name, fn) {
		if (typeof name !== "string" || name === "") {
			throw new Error("Expecting non-empty string for validation name.");
		}

		// write mode
		if (arguments.length > 1) {
			if (typeof fn === "function") fn = fn.toString();
			this.push(fn ? "add" : "remove", "validate", { name, fn });
			return this;
		}

		// read mode
		return this.design.validators[name];
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
			this._play(op);
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
		if (isArray(op)) {
			op.forEach((o) => this._play(o, true));
		}

		// only apply datacore operations
		else {
			Access.play(null, this.design, op);
		}
	}

	static play(security, design, op) {
		if (isArray(op)) {
			op.forEach((o) => Access.play(security, design, o));
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

	toJSON() {
		return {
			private: this.private,
			levels: this.levels
		};
	}

	toDesign() {
		return Design.compile(this.design);
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

		return Promise.resolve().then(() => {
			// immediately copy and remove operations from stack
			ops = this.operations.splice(0, this.operations.length);

			// if there are no operations, we don't need to be here
			if (!ops.length) return;

			// grab the current security document
			return this._getSecurity().then((security) => {
				let sec;

				// apply operations to design
				return this.database.upsert("_design/access", (orig) => {
					let doc = Design.parse(orig);
					sec = security.clone();
					Access.play(sec, doc, ops);
					this._reset(doc);
					doc = Design.compile(doc);
					if (!isEqual(orig, doc)) return doc;
				})

				// save security document on remote databases
				.then(() => {
					if (!this.remote) return;
					let oldSec = security.toJSON();
					let newSec = sec.toJSON();
					if (!isEqual(oldSec, newSec)) return sec.save();
				});
			});
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

// export some parts
Access.hasAccess = hasAccess;
Access.getLevel = getLevel;
Access.hasLevel = hasLevel;
Access.Design = Design;
Access.Operations = Operations;
