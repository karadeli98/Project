var ws = new WebSocket('wss://' + location.host);
var video;
var webRtcPeer;
var currentPresenter = false;
var sessionId;
var active = false;

window.onload = function () {
	
	addViewer();
	

	video = document.getElementById('video');
	document.getElementById('call').addEventListener('click', function () { presenter(); });
	document.getElementById('call').addEventListener('mouseout', function () { tryStop(); });

}

window.onbeforeunload = function () {
	var message = {
		id : 'close',
		sessionId: this.sessionId
	}
	sendMessage(message);
	ws.close();
	
}



ws.onmessage = function (message) {

	var parsedMessage = JSON.parse(message.data);
	//console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
		case 'presenterResponse':
			presenterResponse(parsedMessage);
			break;
		case 'viewerResponse':
			viewerResponse(parsedMessage);
			break;
		case 'stopCommunication':
			dispose();
			break;
		case 'iceCandidate':
			webRtcPeer.addIceCandidate(parsedMessage.candidate)
			break;
		case 'setSessionId':
			sessionId = parsedMessage.sessionID;
			console.info(sessionId);
			break;
		case 'canStartViewer':
			console.log(currentPresenter);
			if (!currentPresenter) {
				viewer();
			}
			break;

		default:
			console.error('Unrecognized message', parsedMessage);
	}
}

function presenterResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);

		var newMessage = {
			id: 'presenterStart',
			sessionID: sessionId

		}
		sendMessage(newMessage);
		active = true;
	}
}

function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function tryStop() {
	try {
		stop();
	} catch (error) {
		console.log(error);
	}
}

function presenter() {
	currentPresenter = true;
	if (!webRtcPeer) {
		showSpinner(video);
		
		var options = {
			localVideo: video,
			onicecandidate: onIceCandidate
		}
		
		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
			if (error) return onError(error);
			this.generateOffer(onOfferPresenter);
		});
	}
}

function addViewer() {
	var message = {
		id: 'addviewer'
	}
	sendMessage(message);
}

function onOfferPresenter(error, offerSdp) {
	if (error) return onError(error);

	var message = {
		id: 'presenter',
		sdpOffer: offerSdp,
		sessionID: sessionId
	};
	sendMessage(message);
}

function viewer() {
	if (!webRtcPeer) {
		showSpinner(video);

		var options = {
			remoteVideo: video,
			onicecandidate: onIceCandidate
		}


		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
			if (error) return onError(error);

			this.generateOffer(onOfferViewer);

		});
	}
}

function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)

	var message = {
		id: 'viewer',
		sdpOffer: offerSdp,
		sessionID: sessionId

	}
	sendMessage(message);
}

function onIceCandidate(candidate) {

	var message = {
		id: 'onIceCandidate',
		candidate: candidate,
		sessionID: sessionId
	}
	sendMessage(message);
}

function stop() {
	if (active) {
		if (webRtcPeer) {
			var message = {
				id: 'stop',
				sessionID: sessionId
			}
			sendMessage(message);
			dispose();
		}
	}
	currentPresenter = false;
	active = false;
}

function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	hideSpinner(video);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	this.waitForConnection(function () {
        ws.send(jsonMessage);
        if (typeof callback !== 'undefined') {
          callback();
        }
    }, 1000);
}

this.waitForConnection = function (callback, interval) {
    if (ws.readyState === 1) {
        callback();
    } else {
        var that = this;
        // optional: implement backoff for interval here
        setTimeout(function () {
            that.waitForConnection(callback, interval);
        }, interval);
    }
};

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */

