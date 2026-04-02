const React = require('react');
const ReactDOMServer = require('react-dom/server');
try {
  const el = React.createElement('div', null, 0n && React.createElement('span'));
  console.log("Rendered:", ReactDOMServer.renderToString(el));
} catch (e) {
  console.error("Error:", e.message);
}
