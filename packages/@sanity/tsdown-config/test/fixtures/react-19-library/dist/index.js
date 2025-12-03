import "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
const bar = /* @__PURE__ */ jsx("div", {});
function Button({ children, type = "button" }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		!1,
		/* @__PURE__ */ jsx("button", {
			type,
			"data-bool": !0,
			children
		}),
		bar
	] });
}
export { Button };

//# sourceMappingURL=index.js.map