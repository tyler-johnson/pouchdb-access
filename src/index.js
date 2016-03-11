import Access from "./access";

export default {
	Access,
	access: function() {
		return new Access(this);
	}
};
