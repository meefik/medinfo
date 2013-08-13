$(document).ready(function () {

    // Global variables.

    soundPlayer = document.createElement("audio");
    soundPlayer.volume = 1;

    forward_list = null;

    // Local variables.

    var username = null;
    var sip_conf = null;
    var call_history = [];
    var ws_was_connected = false;
    var ws_was_registered = false;
    var history_limit = 5;

    // API.

    function getProfile(done, error) {
        $.ajax({
            url: "/api/profile"
        }).done(function (msg) {
                if (done) done(msg);
            }).fail(function (msg) {
                if (error) error();
            });
    }

    function checkAuth(username, password, done, error) {
        $.ajax({
            url: "/api/login",
            type: "POST",
            data: { username: username, password: password }
        }).done(function (msg) {
                if (done) done(msg);
            }).fail(function (msg) {
                if (error) error();
            });
    }

    function logout() {
        $.ajax({
            url: "/api/logout"
        }).done(function (msg) {
                window.location = "/";
            });
    }

    function newReport(callerid, done, error) {
        $.ajax({
            url: "/api/report",
            type: "POST",
            data: { callerid: callerid }
        }).done(function (msg) {
                if (done) return done(msg);
            }).fail(function () {
                if (error) return error();
            });
    }

    function updateReport(reportid, q_key, q_value, done, error) {
        $.ajax({
            url: "/api/report/" + reportid,
            type: "POST",
            data: { q_key: q_key, q_value: q_value }
        }).done(function (msg) {
                if (done) return done(msg);
            }).fail(function (msg) {
                if (error) return error();
            });
    }

    function getReport(reportid, done, error) {
        $.ajax({
            url: "/api/report/" + reportid
        }).done(function (msg) {
                if (done) return done(msg);
            }).fail(function () {
                if (error) return error();
            });
    }

    function getReports(limit, done, error) {
        $.ajax({
            url: "/api/report?limit="+limit
        }).done(function (msg) {
                if (done) return done(msg);
            }).fail(function () {
                if (error) return error();
            });
    }

    function startMedsys(username, callerid) {
        $.ajax({
            url: "http://1220-test.cito.ee/call1.php?user_id=" + username + "&phone_num=" + callerid + "&action=start",
            crossDomain: true,
            dataType: 'jsonp'
        });
    }

    function endMedsys(username, reportid) {
        $.ajax({
            url: "http://1220-test.cito.ee/call1.php?user_id=" + username + "&ext_call_id=" + reportid + "&action=end",
            crossDomain: true,
            dataType: 'jsonp'
        });
    }

    function openMedsys() {
        window.open("http://1220-test.cito.ee/", "medsys");
    }

    function findReportIndexById(reportid) {
        var index = -1;
        for (var i = 0; i < call_history.length; i++) {
            if (call_history[i].id == reportid) {
                index = i;
                break;
            }
        }
        return index;
    }

    // GUI functions.

    function initLoginForm() {

        // Login form.
        var login_form = $("#login-form");
        var login_username = $("#login-form input#username");
        var login_password = $("#login-form input#password");

        function initSession() {
            getProfile(function (msg) {
                login_form.hide();
                username = msg.username;
                sip_conf = msg.sipconf;
                forward_list = msg.forward;
                if (!forward_list) forward_list = [];
                phoneInit();
            }, function () {
                login_form.show();
                login_username.focus();
            });
        }

        login_form.submit(function () {
            login_form.hide();
            checkAuth(login_username.val(), login_password.val(), function () {
                initSession();
            }, function () {
                login_password.val('');
                login_form.show();
            });
            return false;
        });

        initSession();
    }

    /*
     * The change in "Status". Must be caused by one of following values​​:
     * - "connected"
     * - "registered"
     * - "disconnected"
     */
    function setConnectionStatus(status) {
        var connection_status_link = $("#connection-status-link");
        connection_status_link.removeClass("connected registered disconnected");
        switch (status) {
            case "connected":
                connection_status_link.html('<i class="icon-circle"></i> В сети');
                connection_status_link.addClass("connected");
                break;
            case "registered":
                connection_status_link.html('<i class="icon-circle"></i> На связи');
                connection_status_link.addClass("registered");
                break;
            case "disconnected":
                connection_status_link.html('<i class="icon-circle-blank"></i> Не в сети');
                connection_status_link.addClass("disconnected");
                break;
        }
    }

    function updateHistoryList() {
        var subnav = $('#navigation .sub_navigation');
        subnav.find('li').off();
        subnav.html('');
        for (var i = 0; i < call_history.length; i++) {
            var callerid = call_history[i].callerid;
            var reportid = call_history[i].id;
            subnav.append('<li data-callid="' + i + '">№' + reportid + ' (' + callerid + ')</li>');
            subnav.find('li').filter(':last').click(function(){
                showReportForm($(this).attr("data-callid"));
                return false;
            })
        }
    }

    function addReportItem(reportid, callerid) {
        call_history.unshift({ id: reportid, callerid: callerid,
            q_gender: null, q_age: null, q_region: null, q_area: null, q_purpose: null, q_symptom:null });
        if (call_history.length > history_limit) {
            call_history.pop();
        }
        updateHistoryList();
    }

    function showReportForm(id) {
        if (call_history.length > id) {
            // Reset form
            $("#report-form input").val('');
            $("#report-form .result").html('');

            // Set call info
            $("#report .report-title").text('Анкета №' + call_history[id].id);
            $("#report-form").attr("data-reportid", call_history[id].id);

            for(var key in call_history[id]) {
                if (key === "id") continue;
                $("#report-form input[name$='"+key+"']").val(call_history[id][key]);
            }

            changeRegion();

            $("#report").fadeIn(300);
        }
    }

    function changeRegion() {
        var region = $('#report-form input[name="q_region"]');
        var area = $('#report-form input[name="q_area"]');
        var bindAC = function(src) {
            area.autocomplete({
                source: src,
                minLength: 0
            });
        }
        if (region.val() === 'Санкт-Петербург') {
            bindAC(questionnaire.q_spb);
        }
        if (region.val() === 'Ленинградская область') {
            bindAC(questionnaire.q_lenobl);
        }
        if (region.val() === 'Псков') {
            bindAC(questionnaire.q_pskov);
        }
        if (region.val() === 'Псковская область') {
            bindAC(questionnaire.q_pskovobl);
        }
    }

    // Call Events.

    answeredEvent = function (callerid, callback) {
        newReport(callerid, function (msg) {
            addReportItem(msg.id, callerid);
            startMedsys(username, callerid);
            showReportForm(0);
            callback(msg.id);
        });
    }

    hangupEvent = function (reportid) {
        if (reportid) {
            updateReport(reportid, 'hangup', null, function (msg) {
                endMedsys(username, reportid);
            });
        }
    }

    forwardEvent = function(reportid, forwardid) {
        if (reportid) {
            updateReport(reportid, 'forward', forwardid, function (msg) {
                endMedsys(username, reportid);
            });
        }
    }

    // Initialization.

    initLoginForm();


    // Start phone app
    function phoneInit() {

        // Dialer
        var phone_gui = $("#phone");
        var phone_close = $("#phone .close");
        var phone_dialed_number_screen = $("#phone > .controls  input.destination");
        var phone_call_button = $("#phone > .controls > .dialbox > .dial-buttons > .call");
        var phone_chat_button = $("#phone > .controls > .dialbox > .dial-buttons > .chat");
        var phone_dialpad_button = $("#phone > .controls > .dialpad .button");

        // Main menu links.
        var phone_link = $("#phone-link");
        var connection_status_link = $("#connection-status-link");
        var medsys_link = $("#medsys-link");
        var volume_link = $("#volume-link");
        var logout_link = $("#logout-link");
        var report_link = $("#report-link");

        try {
            MyPhone = new JsSIP.UA(sip_conf);
        } catch (e) {
            console.log(e.toString());
            return;
        }

        // Load call history
        getReports(history_limit, function(msg){
            call_history = msg;
            updateHistoryList();
        });

        // Dropdown navigation

        $('#navigation .dropdown').hover(function() {
            $(this).find('.sub_navigation').slideToggle(100);
        });

        // Draggable

        $(".draggable").draggable({
            containment: $("body"),
            drag: function() { // hide popup menu if drag
                $(".ui-autocomplete").hide();
            }
        });

        // Dialer

        phone_call_button.click(function (event) {
            var target = phone_dialed_number_screen.val();
            if (target) {
                phone_gui.fadeOut(300);
                phone_dialed_number_screen.val('');
                GUI.jssipCall(target);
            }
        });

        phone_chat_button.click(function (event) {
            var user, session,
                uri = phone_dialed_number_screen.val();

            if (uri) {
                uri = JsSIP.Utils.normalizeURI(uri, MyPhone.configuration.hostport_params);
                if (uri) {
                    user = uri.user;
                } else {
                    alert('Invalid target');
                    return;
                }

                phone_dialed_number_screen.val("");
                session = GUI.getSession(uri);

                // If this is a new session create it without call.
                if (!session) {
                    session = GUI.createSession(user, uri);
                    GUI.setCallSessionStatus(session, "inactive");
                }

                phone_gui.fadeOut(300);
                $(session).find(".chat input").focus();
            }
        });

        phone_dialpad_button.click(function () {
            if ($(this).hasClass("digit-asterisk"))
                sound_file = "asterisk";
            else if ($(this).hasClass("digit-pound"))
                sound_file = "pound";
            else
                sound_file = $(this).text();
            soundPlayer.setAttribute("src", "sounds/dialpad/" + sound_file + ".ogg");
            soundPlayer.play();

            phone_dialed_number_screen.val(phone_dialed_number_screen.val() + $(this).text());
        });

        phone_dialed_number_screen.keypress(function (e) {
            // Enter pressed? so Dial.
            if (e.which == 13) {
                var target = phone_dialed_number_screen.val();
                if (target) {
                    phone_gui.fadeOut(300);
                    phone_dialed_number_screen.val('');
                    GUI.jssipCall(target);
                }
            }
        });

        phone_close.click(function () {
            $("#phone").fadeOut(300);
        });

        // Bind links.

        // Show operator number
        phone_link.html('<i class="icon-phone icon-large"></i> ' + sip_conf.display_name);
        phone_link.click(function () {
            $("#phone").fadeIn(300, function () {
                phone_dialed_number_screen.focus();
            });
            return false;
        });

        connection_status_link.click(function () {
            if (ws_was_registered) {
                MyPhone.unregister();
            } else {
                MyPhone.register();
            }
            return false;
        });

        //var abc = 0;
        report_link.click(function () {
            //addReportItem(abc++, Math.round(Math.random()*10000000000));
            showReportForm(0);
            return false;
        });

        medsys_link.click(function () {
            openMedsys();
            return false;
        });

        volume_link.click(function () {
            if (soundPlayer.volume > 0) {
                volume_link.html('<i class="icon-volume-off"></i> Звук');
                soundPlayer.volume = 0;
            } else {
                volume_link.html('<i class="icon-volume-up"></i> Звук');
                soundPlayer.volume = 1;
            }
        });

        logout_link.click(function () {
            logout();
            return false;
        });

        // Report Form

        $("#report .close").click(function () {
            //$("#report-form input").trigger('change');
            // For save last change
            $("#report-form button.medsys").focus();
            $("#report").fadeOut(300);
        });

        $("#report-form input").change(function () {
            var result = $(this).parent().parent().find("td.result");
            var reportid = $("#report-form").attr("data-reportid");
            var q_key = $(this).attr("name");
            var q_value = $(this).val();
            result.removeClass("done error");
            result.html('');
            updateReport(reportid, q_key, q_value, function () {
                result.addClass("done");
                result.html('<i class="icon-ok"></i>');
            }, function () {
                result.addClass("error");
                result.html('<i class="icon-remove"></i>');
            });
            var index = findReportIndexById(reportid);
            if (index >= 0) {
                call_history[index][q_key] = q_value;
            }
        });

        $("#report-form button.medsys").click(function () {
            openMedsys();
            return false;
        });

        // Autocomplete
        $("#report-form input").each(function () {
            var q_key = $(this).attr("name");
            var q_value = questionnaire[q_key];
            if (!q_value) q_value = [];
            $(this).autocomplete({
                source: q_value,
                minLength: 0,
                change: function(event, ui) {
                    $(this).trigger("change");
                }
            });
        });

        $("#report-form input").click(function(){
            $(this).autocomplete('search', $(this).val());
        })

        $('#report-form input[name="q_region"]').change(function () {
            changeRegion();
        });


        // Transport connection/disconnection callbacks
        MyPhone.on('connected', function (e) {
            setConnectionStatus("connected");
            ws_was_connected = true;
        });

        MyPhone.on('disconnected', function (e) {
            setConnectionStatus("disconnected");
            // Remove any existing sessions.
            $("#sessions > .session").each(function (i, session) {
                GUI.removeSession(session, 500);
            });
            ws_was_connected = false;
        });

        // Call/Message reception callbacks
        MyPhone.on('newRTCSession', function (e) {
            GUI.new_session(e)
        });

        MyPhone.on('newMessage', function (e) {
            GUI.new_message(e)
        });

        // Registration/Deregistration callbacks
        MyPhone.on('registered', function (e) {
            console.info('Registered');
            setConnectionStatus("registered");
            ws_was_registered = true;
        });

        MyPhone.on('unregistered', function (e) {
            console.info('Deregistered');
            setConnectionStatus("connected");
            ws_was_registered = false;
        });

        MyPhone.on('registrationFailed', function (e) {
            setConnectionStatus("connected");
            ws_was_registered = false;

            if (!e.data.response) {
                console.info("SIP registration error:\n" + e.data.cause);
            } else {
                console.info("SIP registration error:\n" + e.data.response.status_code.toString() + " " + e.data.response.reason_phrase)
            }

            window.location.reload();
        });

        // Start
        MyPhone.start();

        // Remove login page.
        $("#login-background").fadeOut(1000, function () {
            $(this).remove();
        });

    }

    var questionnaire = {
        q_gender: ["Мужчина", "Женщина"],
        q_age: ["до 1 года", "от 1 до 5 лет", "от 6 до 15 лет", "от 16 до 29 лет", "от 30 до 39 лет", "от 40 до 59 лет", "больше 60 лет"],
        q_region: ["Санкт-Петербург", "Ленинградская область", "Псков", "Псковская область"],
        q_spb: ["Адмиралтейский район", "Василеостровский район", "Выборгский район", "Калининский район", "Кировский район", "Колпинский район", "Красногвардейский район", "Красносельский район", "Кронштадтcкий район", "Курортный район", "Московский район", "Невский район", "Петроградский район", "Петродворцовый район", "Приморский район", "Пушкинский район", "Фрунзенский район", "Центральный район"],
        q_pskov: [],
        q_lenobl: ["Бокситогорский район", "Волосовский район", "Волховский район", "Всеволожский район", "Выборгский район", "Гатчинский район", "Кингисеппский район", "Киришский район", "Кировский район", "Лодейнопольский район", "Ломоносовский район", "Лужский район", "Подпорожский район", "Приозерский район", "Сланцевский район", "Тихвинский район", "Тосненский район"],
        q_pskovobl: ["Бежаницкий район", "Великолукский район", "Гдовский район", "Дедовичский район", "Дновский район", "Красногородский район", "Куньинский район", "Локнянский район", "Невельский район", "Новоржевский район", "Новосокольнический район", "Опочецкий район", "Островский район", "Палкинский район", "Печорский район", "Плюсский район", "Порховский район", "Псковский район", "Пустошкинский район", "Пушкиногорский район", "Пыталовский район", "Себежский район", "Стругокрасненский район", "Усвятский район"],
        q_purpose: ["Медицинская консультация", "Справочная информация", "Фармацефтическая информация"],
        q_symptom: ["Боль", "Грипп", "Давление", "Лихорадка", "Психиатрия", "Травма", "Другое"]
    }

});
