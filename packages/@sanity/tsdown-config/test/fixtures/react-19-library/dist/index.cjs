require("react");
let react_jsx_runtime = require("react/jsx-runtime");
const bool = !0, bar = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {});
function Button({ children, type = "button" }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		!1,
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type,
			"data-bool": !0,
			children
		}),
		bar
	] });
}
exports.Button = Button;
