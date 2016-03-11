import {forEach} from "lodash";
import securityPlugin from "pouchdb-security-helper";

const {Security} = securityPlugin;

const Operations = { // jshint ignore:line
	private: {
		// going private ensures all users in levels are in security
		add: function(security, design) {
			design.private = true;
			if (security) forEach(design.levels, function(lvl) {
				security.members.add(lvl.sec);
			});
		},
		// going public clears the security document
		remove: function(security, design) {
			design.private = false;
			if (security) security.members.removeAll();
		}
	},
	level: {
		add: function(security, design, op) {
			let level, before;

			// get existing and remove from stack
			for (let i = 0, lvl; i < design.levels.length; i++) {
				lvl = design.levels[i];
				if (lvl.name !== op.name) continue;
				level = design.levels.splice(i, 1)[0];
			}

			// create a new level if it doesn't exist
			if (level == null) {
				level = {
					name: op.name,
					sec: new Security.Level()
				};
			}

			// get the location in the stack to put it
			if (!op.before) before = design.levels.length;
			else design.levels.some(function(lvl, index) {
				if (lvl.name === op.before) {
					before = index;
					return true;
				}
			});

			// place it there
			if (before == null) {
				throw new Error("No level '" + op.before + "' exists to put level before.");
			} else {
				design.levels.splice(before, 0, level);
			}
		},
		remove: function(security, design, op) {
			// find and remove level
			design.levels.some(function(lvl, index) {
				if (lvl.name !== op.name) return false;
				design.levels.splice(index, 1);
				return true;
			});
		}
	},
	member: function(type, security, design, op) {
		let level;

		design.levels.forEach(function(lvl) {
			// remove member level
			lvl.sec[op.list].remove(op.item);

			// find new level
			if (op.level && lvl.name === op.level) {
				level = lvl;
			}
		});

		// add to new level
		if (type === "add") {
			if (!level) {
				throw new Error("No level '" + op.level + "' exists to change members.");
			}

			level.sec[op.list].add(op.item);
		}

		// change security if private
		if (security && design.private) {
			security.members[op.list][type](op.item);
		}
	},
	filter: {
		add: function(security, design, op) {
			design.filters[op.name] = op.fn;
		},
		remove: function(security, design, op) {
			delete design.filters[op.name];
		}
	},
	validate: {
		add: function(security, design, op) {
			design.validators[op.name] = op.fn;
		},
		remove: function(security, design, op) {
			delete design.validators[op.name];
		}
	}
};

export default Operations;
