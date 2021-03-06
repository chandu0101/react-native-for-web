var EventEmitter = require('eventemitter3');
var {attachListener, removeListener, normalizeTouchEvent} = require('./eventListener');

// Minimal timeout used to delay a bit the events and make events emulation work
var EPS = 100;

// max distance before the touch event is considered a scroll
var MAX_DISTANCE = 10;

// Touch states
var NO_EVENT = 0;
var TOUCH_STARTING = 1;
var TOUCH_STARTED = 2

// collect scrollables, in our case this means all the parent scroll views
function collectParentScrollables(node){
	var scrollables = [];
	var scrollState = {top: 0, left: 0};
	// loop up to root parent and collect scrollables dom elements
	while(node){
		// classname contains scroll-view, so this is a scrollable view.
		if((node.className || '').indexOf('scroll-view') > -1){
			// push into the scrollables list
			scrollables.push({
				node: node,
				top: node.scrollTop, 
				left: node.scrollLeft
			});
			// push into scroll state
			scrollState = {
				top: scrollState.top + node.scrollTop,
				left: scrollState.left + node.scrollLeft
			};
		}
		// go to parent
		node = node.parentNode;
	}
	// returns the collected data
	return {scrollables, scrollState};
}

// returns true if view has scrolled
function detectScroll(scrollablesBefore, scrollablesAfter){
	return !(scrollablesBefore.scrollState.left === scrollablesAfter.scrollState.left && 
		scrollablesBefore.scrollState.top === scrollablesAfter.scrollState.top);
}

// returns the distance between two x, y objects
function distanceBetween(a, b){
	return Math.pow(Math.pow(a.x - b.x, 2) - Math.pow(a.y - b.y, 2), 0.5);
}

class Touchable extends EventEmitter{
	constructor(node){
		super();
		
		// store elements and instances
		this.node = node;
		this.state = NO_EVENT;
		this.pointer = null;
		this.lastPointer = null;
		this.scrollables = null;
		
		// autobind methods
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseOut = this.onMouseOut.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		
		// attach dom event listeners
		attachListener(this.node, 'pointerdown', this.onMouseDown);
		attachListener(window, 'pointermove', this.onMouseMove);
		attachListener(window, 'pointerout', this.onMouseOut);
		attachListener(window, 'pointerup', this.onMouseUp);
	}
	
	destroy(){
		// reset state
		this.state = NO_EVENT;
		this.pointer = null;
		this.scrollables = null;
		this.lastPointer = null;
		
		// detach dom event listeners
		removeListener(this.node, 'pointerdown', this.onMouseDown);
		removeListener(window, 'pointermove', this.onMouseMove);
		removeListener(window, 'pointerout', this.onMouseOut);
		removeListener(window, 'pointerup', this.onMouseUp);
	}
	
	onMouseDown(e){
		var e = normalizeTouchEvent(e);
		// to mouse down, you should first be in no_event
		if(this.state !== NO_EVENT) return;
		// store pointer position
		this.pointer = {x: e.clientX, y: e.clientY};
		this.lastPointer = {x: e.clientX, y: e.clientY};
		this.scrollables = collectParentScrollables(this.node);
		// trigger the touchstart event
		this.state = TOUCH_STARTED;
		this.emit('pressstart');
	}
	
	onMouseMove(e){
		var e = normalizeTouchEvent(e);
		// touch has to be started first
		if(this.state !== TOUCH_STARTED) return;
		// update last position
		this.updateLastPointerFromEvent(e);	
		// cancel if moving
		this.cancelIfMoving();
	}
	
	onMouseOut(e){
		var e = normalizeTouchEvent(e);
		// touch has to be started first
		if(this.state !== TOUCH_STARTED) return;
		// update last position
		this.updateLastPointerFromEvent(e);
		// cancel if moving
		this.emitTouchCancel();
	}
	
	onMouseUp(e){
		// touch has to be started first
		if(this.state !== TOUCH_STARTED) return;
		// update last position
		this.updateLastPointerFromEvent(e);
		// cancel if moving
		if(this.cancelIfMoving()) return;
		// trigger touch end
		this.state = NO_EVENT;
		this.emit('pressend');
	}
	
	updateLastPointerFromEvent(e){
		// normalize event
		var {clientX = null, clientY = null} = normalizeTouchEvent(e);
		// update last pointer position if possible
		if(!(clientX === null || clientY === null)) this.lastPointer = {x: clientX, y: clientY};
	}
	
	cancelIfMoving(){
		// does the mouse moved too much? reset and return
		if(distanceBetween(this.pointer, this.lastPointer) > MAX_DISTANCE) return this.emitTouchCancel();
		// collect new scrollable state, since some ms passed
		var newScrollables = collectParentScrollables(this.node);
		// is a scroll appened? reset and return.
		if(detectScroll(this.scrollables, newScrollables)) return this.emitTouchCancel();
		// return false if not cancelled
		return false;
	}
	
	emitTouchCancel(){
		// emit touch cancel
		this.state = NO_EVENT;
		this.emit('presscancel');
		return true;
	}
}

// export the class
module.exports = Touchable;