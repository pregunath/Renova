// mocks/reactKonvaMock.js
// Minimal stub for react-konva. Only mocks what BoardCanvas.jsx actually imports:
// Stage, Layer, Rect, Group, Image, Line, Text, Transformer

const React = require('react');

const noop = () => null;

// Each Konva component just renders its children (or nothing for leaf nodes).
const Stage = ({ children, ...rest }) => React.createElement('div', { 'data-testid': 'konva-stage', ...rest }, children);
const Layer = ({ children }) => React.createElement(React.Fragment, null, children);
const Group = ({ children }) => React.createElement(React.Fragment, null, children);
const Rect = noop;
const Image = noop;
const Line = noop;
const Text = noop;
const Transformer = noop;

module.exports = { Stage, Layer, Rect, Group, Image, Line, Text, Transformer };
