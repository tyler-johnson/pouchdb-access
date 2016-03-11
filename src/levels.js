import hasAccess from "./has-access";

export function getLevel(levels, userCtx) {
	if (typeof userCtx === "string") userCtx = { name: userCtx };

	// look through levels backwards to find the highest one the user has access to
	for (var lvl, i = levels.length - 1; i >= 0; i--) {
		lvl = levels[i];
		if (hasAccess(lvl.sec, userCtx)) return lvl.name;
	}

	return null;
}

export function hasLevel(levels, userCtx, level) {
	if (typeof userCtx === "string") userCtx = { name: userCtx };
	var found = false;

	return levels.some(function(lvl) {
		// find the minimum desired level
		if (lvl.name === level) found = true;

		// once found, test access
		return found && hasAccess(lvl.sec, userCtx);
	});
}
