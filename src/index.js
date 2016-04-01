import Access from "./access";

export default {
	Access,
	access: function(design, opts) {
		return new Access(this, design, opts);
	}
};
