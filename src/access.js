import Design from "./design";
import Operations from "./operations";
import {EventEmitter} from "events";
import hasAccess from "./has-access";
import {getLevel,hasLevel} from "./levels.js";
import securityPlugin from "pouchdb-security-helper";
import {isEqual} from "lodash";
import Transform from "./transform";

const {Security} = securityPlugin;

export default class Access extends EventEmitter {
	static hasAccess = hasAccess;
	static getLevel = getLevel;
	static hasLevel = hasLevel;
	static Design = Design;
	static Operations = Operations;

  constructor(db, design, opts={}) {
    super();

    if (db instanceof Access) {
      design = db.toDesign();
      db = db.database;
    }

    // are we talking directly to CouchDB?
    // this dictates whether or not we can write the access document
    this.remote = db && db.adapter === "http";
    // db to get and put with
    this.database = db;
		// extract sync method from options
		this.sync = opts.sync || Access.sync;
    // set user options directly
    this.options = opts;
    // set the current design
    this.setDesign(design);
  }

  reset(design) {
		this.design = design;
		return this;
	}

  setDesign(doc) {
		if (doc instanceof Access) doc = doc.toDesign();
		this._reset(Design.parse(doc));
		this.emit("design", this.design);
		return this;
	}

  _getDesign() {
		return this.database.get("_design/access").catch((e) => {
			if (e.status !== 404) throw e;
		}).then((doc) => {
			return Design.parse(doc);
		});
	}

	fetch() {
		this.emit("fetch");
		return this._getDesign().then((d) => this.reset(d));
	}

	getLevel(userCtx) {
		return getLevel(this.design.levels, userCtx);
	}

	hasLevel(userCtx, level) {
		return hasLevel(this.design.levels, userCtx, level);
	}

	get levels() {
		return this.design.levels;
	}

	get private() {
		return this.design.private;
	}

	get public() {
		return !this.design.private;
	}

	toJSON() {
		return {
			private: this.private,
			levels: this.levels.map(({name,sec}) => {
				return { name, sec: sec.toJSON() };
			})
		};
	}

	toDesign() {
		return Design.compile(this.design);
	}

	transform(opts) {
		const tr = new Transform(this, opts);
		this.emit("transform", tr);
		return tr;
	}

  static sync(ops) {
		const security = new Security(this.database);
		let sec;

		// grab the current security document
		Promise.resolve(this.remote ? security.fetch() : null)

		// apply operations to design
		.then(() => {
			return this.database.upsert("_design/access", (orig) => {
				let doc = Design.parse(orig);
				sec = security.clone();
				Transform.play(sec, doc, ops);
				this._reset(doc);
				doc = Design.compile(doc);
				if (!isEqual(orig, doc)) return doc;
			});
		})

		// save security document on remote databases
		.then(() => {
			if (!this.remote) return;
			let oldSec = security.toJSON();
			let newSec = sec.toJSON();
			if (!isEqual(oldSec, newSec)) return sec.save();
		});
	}
}
