window.GUI = {

    /*
     * JsSIP.UA new_session event listener
     */
    new_session: function (e) {

        var display_name, status,
            request = e.data.request,
            call = e.data.session,
            uri = call.remote_identity.uri,
            session = GUI.getSession(uri);

        display_name = call.remote_identity.display_name || call.remote_identity.uri.user;

        if (call.direction === 'incoming') {
            status = "incoming";
        } else {
            status = "trying";
        }

        // If the session exists with active call reject it.
        if (session && !$(session).find(".call").hasClass("inactive")) {
            call.terminate();
            return false;
        }

        // If this is a new session create it
        if (!session) {
            session = GUI.createSession(display_name, uri);
        }

        // Associate the JsSIP Session to the HTML div session
        session.call = call;
        GUI.setCallSessionStatus(session, status);
        //$(session).find(".chat input").focus();

        // EVENT CALLBACK DEFINITION

        // Progress
        call.on('progress', function (e) {
            if (e.data.originator === 'remote') {
                GUI.setCallSessionStatus(session, 'in-progress');
            }
        });

        // Started
        call.on('started', function (e) {

            //Attach the streams to the views if it exists.
            if (call.getLocalStreams().length > 0) {
                selfView.src = window.URL.createObjectURL(call.getLocalStreams()[0]);
                selfView.volume = 0;
            }

            if (call.getRemoteStreams().length > 0) {
                remoteView.src = window.URL.createObjectURL(call.getRemoteStreams()[0]);
            }

            GUI.setCallSessionStatus(session, 'answered');
        });

        // Failed
        call.on('failed', function (e) {
            var
                cause = e.data.cause,
                response = e.data.response;

            if (e.data.originator === 'remote' && cause.match("SIP;cause=200", "i")) {
                cause = 'answered_elsewhere';
            }

            GUI.setCallSessionStatus(session, 'terminated', cause);
            soundPlayer.setAttribute("src", "sounds/outgoing-call-rejected.wav");
            soundPlayer.play();
            GUI.removeSession(session, 1500);
        });

        // NewDTMF
        call.on('newDTMF', function (e) {
            if (e.data.originator === 'remote') {
                sound_file = e.data.dtmf.tone;
                soundPlayer.setAttribute("src", "sounds/dialpad/" + sound_file + ".ogg");
                soundPlayer.play();
            }
        });

        // Ended
        call.on('ended', function (e) {
            var cause = e.data.cause;

            GUI.setCallSessionStatus(session, "terminated", cause);
            GUI.removeSession(session, 1500);
        });
    },


    /*
     * JsSIP.UA new_message event listener
     */
    new_message: function (e) {
        var display_name, text,
            message = e.data.message,
            request = e.data.request,
            uri = message.remote_identity,
            session = GUI.getSession(uri);

        if (message.direction === 'incoming') {
            display_name = request.from.display_name || request.from.uri.user;
            text = request.body;

            // If this is a new session create it with call status "inactive", and add the message.
            if (!session) {
                session = GUI.createSession(display_name, uri);
                GUI.setCallSessionStatus(session, "inactive");
            }

            $(session).find(".peer > .display-name").text(display_name);
            GUI.addChatMessage(session, "peer", text);
            $(session).find(".chat input").focus();
        } else {
            message.on('failed', function (e) {
                var response = e.data.response;
                if (response)
                    GUI.addChatMessage(session, "error", response.status_code.toString() + " " + response.reason_phrase);
                else
                    GUI.addChatMessage(session, "error", e.data.cause.toString());
            });
        }
    },


    /*
     * Esta función debe ser llamada por jssip al recibir un MESSAGE
     * de tipo application/im-iscomposing+xml,
     * y debe pasar como parámetro el From URI (sip:user@domain) y otro
     * parámetro active que es:
     * - true: es un evento "iscomposing active"
     * - false: es un evento "iscomposing idle"
     */
    phoneIsComposingReceived: function (uri, active) {
        var session = GUI.getSession(uri);

        // If a session does not exist just ignore it.
        if (!session)
            return false;

        var chatting = $(session).find(".chat > .chatting");

        // If the session has no chat ignore it.
        if ($(chatting).hasClass("inactive"))
            return false;

        if (active)
            $(session).find(".chat .iscomposing").show();
        else
            $(session).find(".chat .iscomposing").hide();
    },


    /*
     * Busca en las sessions existentes si existe alguna con mismo peer URI. En ese
     * caso devuelve el objeto jQuery de dicha session. Si no, devuelve false.
     */
    getSession: function (uri) {
        var session_found = null;

        $("#sessions > .session").each(function (i, session) {
            if (uri == $(this).find(".peer > .uri").text()) {
                session_found = session;
                return false;
            }
        });

        if (session_found)
            return session_found;
        else
            return false;
    },


    createSession: function (display_name, uri) {
        $("#sessions").append('<div class="session">' + $("#templates .session").html() + '</div>');

        var session = $("#sessions .session").filter(":last");
        var caller_name = $(session).find(".display-name");
        var caller_uri = $(session).find(".uri");
        var call_status = $(session).find(".call");
        var close = $(session).find("> .close");
        var chat_input = $(session).find(".chat > input[type='text']");

        caller_name.text(display_name);
        caller_uri.text(uri);

        $(session).hover(function () {
                if ($(call_status).hasClass("inactive"))
                    $(close).show();
            },
            function () {
                $(close).hide();
            });

        close.click(function () {
            GUI.removeSession(session, null, true);
        });

        chat_input.focus(function (e) {
            if ($(this).hasClass("inactive")) {
                $(this).val("");
                $(this).removeClass("inactive");
            }
        });

        chat_input.blur(function (e) {
            if ($(this).val() == "") {
                $(this).addClass("inactive");
                $(this).val("введите сообщение...");
            }
        });

        chat_input.keydown(function (e) {
            // Ignore TAB and ESC.
            if (e.which == 9 || e.which == 27) {
                return false;
            }
            // Enter pressed? so send chat.
            else if (e.which == 13 && $(this).val() != "") {
                var text = chat_input.val();
                GUI.addChatMessage(session, "me", text);
                chat_input.val("");
                GUI.jssipMessage(uri, text);
            }
            // Ignore Enter when empty input.
            else if (e.which == 13 && $(this).val() == "") {
                return false;
            }
            // NOTE is-composing stuff.
            // Ignore "windows" and ALT keys, DEL, mayusculas and 0 (que no sé qué es).
            else if (e.which == 18 || e.which == 91 || e.which == 46 || e.which == 16 || e.which == 0)
                return false;
            // If this is the first char in the input and the chatting session
            // is active, then send a iscomposing notification.
            else if (e.which != 8 && $(this).val() == "") {
                GUI.jssipIsComposing(uri, true);
            }
            // If this is a DELETE key and the input has been totally clean, then send "idle" isomposing.
            else if (e.which == 8 && $(this).val().match("^.$"))
                GUI.jssipIsComposing(uri, false);
        });

        $(session).fadeIn(100);

        // Return the jQuery object for the created session div.
        return session;
    },


    setCallSessionStatus: function (session, status, description) {
        var session = session;
        var uri = $(session).find(".peer > .uri").text();
        var call = $(session).find(".call");
        var caller_name = $(session).find(".display-name");
        var status_text = $(session).find(".call-status");
        var button_dial = $(session).find(".button.dial");
        var button_hangup = $(session).find(".button.hangup");
        var button_hold = $(session).find(".button.hold");
        var button_resume = $(session).find(".button.resume");
        var button_dtmf = $(session).find(".button.dtmf");
        var button_forward = $(session).find(".button.forward");
        var dtmf_box = $(session).find(".dtmf-box");
        var forward_box = $(session).find(".forward-box");

        var box_hide = function () {
            dtmf_box.hide();
            forward_box.hide();
        }

        // If the call is not inactive or terminated, then hide the
        // close button (without waiting for blur() in the session div).
        if (status != "inactive" && status != "terminated") {
            $(session).unbind("hover");
            $(session).find("> .close").hide();
        }

        // Unset all the functions assigned to buttons.
        button_dial.unbind("click");
        button_hangup.unbind("click");
        button_hold.unbind("click");
        button_resume.unbind("click");
        button_dtmf.unbind("click");
        button_forward.unbind("click");

        if (session.call && session.call.status !== JsSIP.C.SESSION_TERMINATED) {
            button_hangup.click(function () {
                GUI.setCallSessionStatus(session, "terminated");
                session.call.terminate();
                GUI.removeSession(session, 500);
            });
        }

        switch (status) {
            case "inactive":
                call.removeClass();
                call.addClass("call inactive");
                status_text.text("");

                button_dial.click(function () {
                    GUI.jssipCall(uri);
                });

                box_hide();
                break;

            case "trying":
                call.removeClass();
                call.addClass("call trying");
                status_text.text(description || "набор номера...");

                box_hide();
                break;

            case "in-progress":
                call.removeClass();
                call.addClass("call in-progress");
                status_text.text(description || "идет вызов...");

                // ring-back.
                soundPlayer.setAttribute("src", "sounds/outgoing-call2.ogg");
                soundPlayer.play();

                box_hide();
                break;

            case "answered":
                // If answered after incoming
                if ($(session).find(".incoming").length > 0) {
                    // Global answered event
                    answeredEvent(caller_name.text(), function(reportid) {
                        $(session).attr("data-reportid", reportid);
                    });
                }

                call.removeClass();
                call.addClass("call answered");
                status_text.text(description || "вызов принят");

                // Start timer
                var time = 0;
                var timer = setInterval(function () {
                    time++;
                    var seconds = time % 60;
                    var minutes = time / 60 | 0;
                    if (seconds < 10) seconds = "0"+seconds;
                    status_text.text(minutes+":"+seconds);
                }, 1000);
                status_text.attr("data-timer",timer);

                button_dtmf.click(function () {
                    forward_box.hide();
                    dtmf_box.toggle();
                });
                button_forward.click(function () {
                    dtmf_box.hide();
                    forward_box.toggle();
                });
                forward_box.html('');
                for (var i = 0; i < forward_list.length; i++) {
                    forward_box.append('<div class="forward-row" data-forward-number="'+
                        forward_list[i].phone+'">'+forward_list[i].name+'</div>');
                }
                forward_box.find(".forward-row").click(function () {
                    var forwardid = $(this).attr("data-forward-number");
                    session.call.sendDTMF(forwardid);
                    var reportid = $(session).attr("data-reportid");
                    // Global forward event
                    forwardEvent(reportid, forwardid);
                });

                var dtmf_button = $(dtmf_box).find(".dtmf-button");
                var sound_file;
                dtmf_button.click(function () {
                    if ($(this).hasClass("digit-asterisk"))
                        sound_file = "asterisk";
                    else if ($(this).hasClass("digit-pound"))
                        sound_file = "pound";
                    else
                        sound_file = $(this).text();
                    soundPlayer.setAttribute("src", "sounds/dialpad/" + sound_file + ".ogg");
                    soundPlayer.play();

                    session.call.sendDTMF($(this).text());
                });
                break;

            case "terminated":
                // If terminated after answered
                if ($(session).find(".answered").length > 0) {
                    var reportid = $(session).attr("data-reportid");
                    // Global hangup event
                    hangupEvent(reportid);
                }
                // Stop timer
                var timer = status_text.attr("data-timer");
                clearInterval(timer);

                call.removeClass();
                call.addClass("call terminated");
                status_text.text(description || "вызов завершен");
                button_hangup.unbind("click");

                box_hide();
                break;

            case "incoming":
                call.removeClass();
                call.addClass("call incoming");
                status_text.text(description || "входящий вызов...");
                soundPlayer.setAttribute("src", "sounds/incoming-call2.ogg");
                soundPlayer.play();

                button_dial.click(function () {
                    call.removeClass();
                    call.addClass("call trying");
                    session.call.answer({
                        mediaConstraints: { audio: true, video: false }
                    });
                });

                box_hide();
                break;

            default:
                console.log("ERROR: setCallSessionStatus() called with unknown status '" + status + "'");
                break;
        }
    },


    removeSession: function (session, time, force) {
        var default_time = 500;
        var uri = $(session).find(".peer > .uri").text();
        var chat_input = $(session).find(".chat > input[type='text']");

        if (force || ($(session).find(".chat .chatting").hasClass("inactive") && (chat_input.hasClass("inactive") || chat_input.val() == ""))) {
            time = ( time ? time : default_time );
            $(session).fadeTo(time, 0.7, function () {
                $(session).slideUp(100, function () {
                    $(session).remove();
                });
            });
            // Enviar "iscomposing idle" si estábamos escribiendo.
            if (!chat_input.hasClass("inactive") && chat_input.val() != "")
                GUI.jssipIsComposing(uri, false);
        }
        else {
            // Como existe una sesión de chat, no cerramos el div de sesión,
            // en su lugar esperamos un poco antes de ponerlo como "inactive".
            setTimeout('GUI.setDelayedCallSessionStatus("' + uri + '", "inactive")', 1000);
        }

    },


    setDelayedCallSessionStatus: function (uri, status, description, force) {
        var session = GUI.getSession(uri);
        if (session)
            GUI.setCallSessionStatus(session, status, description, force);
    },


    /*
     * Añade un mensaje en el chat de la sesión.
     * - session: el objeto jQuery de la sesión.
     * - who: "me" o "peer".
     * - text: el texto del mensaje.
     */
    addChatMessage: function (session, who, text) {
        var chatting = $(session).find(".chat > .chatting");
        $(chatting).removeClass("inactive");

        if (who != "error") {
            var who_text = ( who == "me" ? "я" : $(session).find(".peer > .display-name").text() );
            var message_div = $('<p class="' + who + '"><b>' + who_text + '</b>: ' + text + '</p>');
        }
        // ERROR sending the MESSAGE.
        else {
            var message_div = $('<p class="error"><i>message failed: ' + text + '</i>');
        }
        $(chatting).append(message_div);
        $(chatting).scrollTop(1e4);

        if (who == "peer") {
            soundPlayer.setAttribute("src", "sounds/incoming-chat.ogg");
            soundPlayer.play();
        }

        // Si se había recibido un iscomposing quitarlo (sólo si es message entrante!!!).
        if (who == "peer")
            $(session).find(".chat .iscomposing").hide();
    },


    jssipCall: function (target) {
        try {
            MyPhone.call(target, {
                mediaConstraints: { audio: true, video: false },
                RTCConstraints: {"optional": [
                    {'DtlsSrtpKeyAgreement': 'true'}
                ]}
            });
        } catch (e) {
            throw(e);
            return;
        }
    },


    jssipMessage: function (uri, text) {
        try {
            MyPhone.sendMessage(uri, text);
        } catch (e) {
            throw(e);
            return;
        }
    },


    jssipIsComposing: function (uri, active) {
        //JsSIP.API.is_composing(uri, active);
        //console.info('is compossing..')
    }

};
