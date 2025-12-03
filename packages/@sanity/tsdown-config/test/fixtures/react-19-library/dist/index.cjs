require("react");
let react_jsx_runtime = require("react/jsx-runtime");

const bool = true;
const bar = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {});
function Button({ children, type = "button" }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		false,
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type,
			"data-bool": bool,
			children
		}),
		bar
	] });
}

exports.Button = Button;