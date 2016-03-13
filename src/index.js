import Access from "./access";

export default {
	Access,
	access: function(design) {
		return new Access(this, design);
	}
};
