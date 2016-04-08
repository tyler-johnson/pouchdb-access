import {clone,assign,reduce,isEmpty,keys} from "lodash";
import securityPlugin from "pouchdb-security-helper";
import hasAccess from "./has-access";
import {getLevel,hasLevel} from "./levels.js";

const {Security} = securityPlugin;

const Design = { // jshint ignore:line
	prefix: function(type) {
		return "/*>>>>>>" + type.toUpperCase() + ">>>>>>*/";
	},
	postfix: function(type) {
		return "/*<<<<<<" + type.toUpperCase() + "<<<<<<*/";
	},
	wrap: function(type, val) {
		return Design.prefix(type) + val + Design.postfix(type);
	},
	extract: function(src, type) {
		if (typeof src !== "string" || !src) return null;

		var prefix = Design.prefix(type);
		var start = src.indexOf(prefix);
		if (start < 0) return null;
		start += prefix.length; // adjust for prefix length

		var end = src.indexOf(Design.postfix(type), start);
		if (end < 0) return null;

		return src.substring(start, end);
	},
	exportify: function(str) {
		return "module.exports = " + str + ";";
	},
	unexportify: function(str) {
		let h = "module.exports = ";
		if (str.substr(0, h.length) === h) str = str.substr(h.length);
		if (str.substr(-1) === ";") str = str.substr(0, str.length - 1);
		return str;
	},
	levels: {
		parse: function(src) {
			let levels;

			if (Array.isArray(src)) {
				levels = src;
			} else {
				levels = Design.extract(src, "levels");
				if (levels) {
					try { levels = JSON.parse(levels); }
					catch(e) { e; }
				}

				if (!Array.isArray(levels)) levels = [];
			}

			return levels.map(function(lvl) {
				if (!lvl.name) return;
				lvl = clone(lvl);
				lvl.sec = new Security.Level(lvl.sec);
				return lvl;
			}).filter(Boolean);
		},
		stringify: function(levels) {
			var src = "";
			src += hasAccess.toString() + ";\n";
			src += "var levels = exports.levels = " + Design.wrap("levels", JSON.stringify(levels)) + ";\n";
			src += "exports.getLevel = (" + getLevel.toString() + ").bind(null, levels);\n";
			src += "exports.hasLevel = (" + hasLevel.toString() + ").bind(null, levels);\n";
			return src;
		}
	},
	validators: {
		parse: function(validators) {
			if (!validators) return {};
			return reduce(validators, function(v, f, n) {
				v[n] = typeof f === "function" ? f :
					typeof f === "string" ? Design.unexportify(f) : null;

				return v;
			}, {});
		},
		stringify: function(validators) {
			if (!validators) return {};
			return reduce(validators, function(v, f, n) {
				v[n] = Design.exportify(f);
				return v;
			}, {});
		}
	},
	validate_doc_update: function(validators) {
		return `function(newDoc, oldDoc, userCtx) {
			var list = ${JSON.stringify(keys(validators))};
			for (var i = 0; i < list.length; i++) {
				require("validators/" + list[i]).apply(this, arguments);
			}
		}`;
	},
	parse: function(design) {
		design = assign({
			language: "javascript",
			private: false
		}, design);

		design.filters = assign({}, design.filters);
		design.levels = Design.levels.parse(design.levels);
		design.validators = Design.validators.parse(design.validators);

		return design;
	},
	compile: function(design) {
		design = assign({
			language: "javascript",
			private: false
		}, design);

		design.levels = Design.levels.stringify(design.levels);
		if (!design.levels) delete design.levels;

		design.validators = Design.validators.stringify(design.validators);
		if (isEmpty(design.validators)) {
			delete design.validators;
			delete design.validate_doc_update;
		} else {
			design.validate_doc_update = Design.validate_doc_update(design.validators);
		}

		if (isEmpty(design.filters)) delete design.filters;

		return design;
	}
};

export default Design;
