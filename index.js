// script to generate fake patient data, unit level historical census data, and pain assessment metrics

var faker = require('faker');

// note this does an implicit conversion from UTC to local,
// but for our purposes, it doesn't matter
function cvtDate(dt) {
    var dayStr = '';
    var monStr = '';

    let day = dt.getDate();
    let mon = dt.getMonth() + 1;
    let yrStr = dt.getFullYear().toString();
    if (day < 10) { dayStr = '0' + day; } else { dayStr = day; }
    if (mon < 10) { monStr = '0' + mon; } else { monStr = mon; }

    return yrStr + "-" + monStr + "-" + dayStr;
}

function cvtDateTime(dt) {
    var minutes = dt.getMinutes();
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return cvtDate(dt) + " " + dt.getHours() + ":" + minutes;
}

function genPatients() {
    var cntr = 0;
    var nameLast = '';
    var nameFirst = '';
    var mrn = '';
    var dob = '';

    while (cntr < 100) {
        nameLast = faker.name.lastName();
        nameFirst = faker.name.firstName();
        mrn = faker.random.number({
            'min': 6000000,
            'max': 6999999
        }).toString();

        // note this does an implicit conversion from UTC to local,
        // but for our purposes, it doesn't matter
        dob = cvtDate(faker.date.between('1950-01-01', '2020-09-01'));

        s = "insert into PA_PATIENT( mrn, nameLast, nameFirst, dob) values ('" + mrn + "', '" + nameLast + "', '" + nameFirst + "', '" + dob + "');"
        console.log(s);
        cntr++;
    }
}

function genPatientUnits() {
    var cntr = 0;
    // 2 hours... 86400 seconds/day / 12 (to get 2 hrs) * 1000 milliseconds
    var low = 86400 / 12 * 1000;
    // high 5 days...
    var high = 86400 * 1000 * 5;
    var start = new Date();
    var d = 0;
    var end = new Date("September 1, 2020 00:00:00");
    var next = new Date();
    var unit = 0;
    var startAt = '';
    var nextAt = '';
    var incr = 0;

    cntr = 1
    while (cntr <= 100) {
        start = new Date("March 28, 2020 07:00:00");
        startAt = cvtDateTime(start);
        while (start < end) {
            incr = faker.random.number({ 'min': low, 'max': high });
            d = start.getTime() + incr;
            next.setTime(d);
            nextAt = cvtDateTime(next);

            unit = faker.random.number({ 'min': 1, 'max': 7 });

            s = "insert into PA_PATIENT_UNIT (patientId, unitId, startedAt, endedAt) values (" + cntr + ", " +
                unit + ", '" + startAt + "', '" + nextAt + "');";
            console.log(s);
            start = next;
            startAt = nextAt;
        }
        cntr++;
    }
}

function genPatientAssessments() {
    var cntr = 0;
    // let's say the randomly assessed (or not) sometime between 1 hour and 6 hrs
    // incr will hold the number of milliseconds between 1 hour (low) and
    // 6 hours (high)
    var incr = 0;
    var low = 86400 / 24 * 1000;
    var high = 86400 / 24 * 6 * 1000;

    // start and startMilli represent time at last assessment
    // no assessments to occur on or after end
    var start = new Date();
    var end = new Date("September 1, 2020 00:00:00");

    // target is to check if assessment occurred within last 4 hours
    var delta = 86400 / 24 * 4 * 1000;

    // next, nextMilli nextAt are when next assessment occurs
    var next = new Date();
    var nextMilli = next.getTime();
    var nextAt = '';

    // target, targetMilli, targetAt are when next assessment should occur
    var target = new Date();
    var targetMilli = next.getTime();
    var targetAt = '';

    // rand is a number generated to be used to determine whether assessment occured,
    // was unable to be performed, or was missed.
    var rand = 0;

    // helper for times when assessments should have occurred
    var hourIncr = 86400 / 24 * 1 * 1000;
    // helpers for populating pain scores
    var valInt = 0

    // for our 100 patients
    cntr = 1
    while (cntr <= 100) {
        // starting at the beginning of their stays...
        start = new Date("March 28, 2020 07:00:00");

        while (start < end) {
            // how far out should be our next event?
            incr = faker.random.number({ 'min': low, 'max': high });

            // let's say
            // 5% of assessments are missed
            // 15% of assessments are unable to be performed (sleeping, for example)
            // and if we miss, try again next hour
            while ((rand = faker.random.number({ 'min': 0, 'max': 100 })) <= 5) {
                incr = incr + hourIncr;
            }

            // set date of next event
            nextMilli = start.getTime() + incr;
            next.setTime(nextMilli);
            nextAt = cvtDateTime(next);

            // set date of target event
            targetMilli = start.getTime() + delta;
            target.setTime(targetMilli);
            targetAt = cvtDateTime(target);

            // record hours where pain assessmnets due but didn't happen
            while (incr >= delta && next.getHours() !== target.getHours()) {
                s = "call seed_PA_AGG_data( " + cntr + ", '" + targetAt + "', 'missed pain assess', null );";
                console.log(s);

                // set date of target event
                targetMilli = target.getTime() + hourIncr;
                target.setTime(targetMilli);
                targetAt = cvtDateTime(target);
            }

            valInt = faker.random.number({ 'min': 1, 'max': 5 });
            if (rand <= 20) {
                if (incr <= delta) {
                    s = "call seed_PA_AGG_data( " + cntr + ", '" + nextAt + "', 'unable to pain assess', null );";
                } else {
                    s = "call seed_PA_AGG_data( " + cntr + ", '" + nextAt + "', 'unable to pain assess (late)', null );";
                }
                console.log(s);
            } else {
                if (incr <= delta) {
                    s = "call seed_PA_AGG_data( " + cntr + ", '" + nextAt + "', 'pain assess', " + valInt + " );";
                } else {
                    s = "call seed_PA_AGG_data( " + cntr + ", '" + nextAt + "', 'pain assess (late)', " + valInt + " );";
                }
                console.log(s);
            }
                
            valInt = Math.ceil(incr / 1000 / 60);
            s = "call seed_PA_AGG_data( " + cntr + ", '" + nextAt + "', 'min since prev pain assess', " + valInt + " );";
            console.log(s);

            start.setTime(next.getTime());
        }
        cntr++;
    }
}

genPatients();
genPatientUnits();
genPatientAssessments();

