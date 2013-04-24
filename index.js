
var _ = require('gl519')
var request = require('request')

var odesk = require('node-odesk')
module.exports = odesk

odesk.prototype.getAll = function (path, params) {
    var kind = path.match(/([^\/]+)s(\?|$)/)[1]
    var kinds = kind + 's'
    if (!params) params = {}

    var accum = []
    var offset = 0
    var pageSize = 4
    while (true) {
        params.page = offset + ';' + pageSize
        var a = _.p(this.get(path, params, _.p()))[kinds]
        var b = a[kind]
        if (b) {
            if (b instanceof Array)
                accum.push(b)
            else
                accum.push([b])
        } else {
            break
        }
        offset += pageSize
        if (offset >= a.lister.total_count)
            break
    }
    return [].concat.apply([], accum)
}

odesk.prototype.closeFixedPriceJob = function (user, pass, securityAnswer, teamRef, jobRef, comment) {

    if (!comment) comment = 'Great work!'

    circumventAPI(user, pass, securityAnswer, '/e/' + teamRef + '/contracts/' + jobRef + '/close', [
        ['payWhat', 'remaining'],
        ['amount', ''],
        ['reason', 104],
        ['noStartReason', ''],
        ['noStartComment', ''],
        ['feedbackScores[feedbackScores1]', 5],
        ['feedbackScores[feedbackScores2]', 5],
        ['feedbackScores[feedbackScores3]', 5],
        ['feedbackScores[feedbackScores4]', 5],
        ['feedbackScores[feedbackScores5]', 5],
        ['feedbackScores[feedbackScores6]', 5],
        ['comment', comment]
    ])
}

odesk.prototype.postFixedPriceJob = function (user, pass, securityAnswer, teamRef, catName, subCatName, title, desc, skills, budget, is_public) {

    is_public = !((is_public === false) || (is_public == "private"))

    function getDateFromNow(fromNow) {
        var d = new Date(_.time() + fromNow)
        function zeroPrefix(x) { x = "" + x; return x.length < 2 ? '0' + x : x }
        return zeroPrefix(d.getMonth() + 1) + "-" + zeroPrefix(d.getDate()) + "-" + d.getFullYear()
    }

    circumventAPI(user, pass, securityAnswer, '/e/' + teamRef + '/jobs/new/', [
        ['team', teamRef],
        ['category', catName],
        ['subcategory', cats[catName][subCatName]],
        ['title', title],
        ['languageFrom', ''],
        ['languageTo', ''],
        ['wordCount', ''],
        ['description', desc],
        ['skills', skills],
        ['parsed_skills', skills],
        ['job_type', 'Fixed'],
        ['job_length', ''],
        ['job_hours', ''],
        ['job_budget', (1 * budget).toFixed(2)],
        ['job_finish_date', getDateFromNow(1000 * 60 * 60 * 24 * 7)],
        ['initial_state', 'all'],
        ['ic_ac_clicked', 0],
        ['advanced_opt_clicked', 0],
        ['advanced_opt_changed', 0],
        ['candidate_type_pref[]', 'individuals'],
        ['candidate_type_pref[]', 'agencies'],
        ['visibility', is_public ? 'public' : 'private'],
        ['indexing', 0],
        ['indexing', 1],
        ['MAX_FILE_SIZE', 33554432],
        'Content-Disposition: form-data; name="attachment"; filename=""\nContent-Type: application/octet-stream\n\n\n',
        ['job_start_date', getDateFromNow(0)],
        ['feedback_score', 0],
        ['job_horly_rate_min', ''],
        ['job_horly_rate_max', ''],
        ['location', ''],
        ['tests', 0],
        ['has_portfolio', 0],
        ['english_level', 0],
        ['billed_hours', 0]
    ])
}

function circumventAPI(user, pass, securityAnswer, path, multipart) {

    var url = 'https://www.odesk.com' + path

    var j = request.jar()
    function req(method, url, params) {
        var options = {
            method : method,
            uri : url,
            jar : j
        }
        if (method.match(/^post$/i))
            options.form = params || {}
        var p = _.p()
        request(options, function (err, res, body) {
            if (err) p(err)
            else if (res.statusCode != 200) p(new Error('failed to access: ' + url))
            else p(body)
        })
        return _.p()
    }

    req('get', 'https://www.odesk.com/login')
    req('post', 'https://www.odesk.com/login', {
        username : user,
        password : pass,
        remember_me : 0
    })

    function getToken(s) {
        var m = s.match(/type="hidden" name="_token" value="(.*?)"/)
        if (!m) throw new Error('failed to find "_token" in page')
        return m[1]
    }

    // answer security question, maybe
    var s = req('get', url)
    if (s.indexOf('action="/UserSettings/account-security/device-authorization"') >= 0) {

        req('post', 'https://www.odesk.com/UserSettings/account-security/device-authorization', {
            answer : securityAnswer,
            remember : 0,
            _token : getToken(s)
        })

        s = req('get', url)
    }

    multipart.unshift(['_token', getToken(s)])
    multipart = _.map(multipart, function (m) {
        if (Array.isArray(m)) {
            return 'Content-Disposition: form-data; name="' + m[0] + '"\n\n' + m[1] + '\n'
        }
        return m
    })
    while (true) {
        var boundary = '------WebKitFormBoundary' + _.randomString(16)
        if (!_.find(multipart, function (s) {
            return s.indexOf(boundary) >= 0
        })) break
    }
    multipart = boundary + '\n' + multipart.join(boundary + '\n') + boundary + '--'
    multipart = multipart.replace(/\n/g, '\r\n')

    var https = require('https')
    var options = {
        hostname: 'www.odesk.com',
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            Accept : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Charset' : 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
            'Accept-Encoding' : 'gzip,deflate,sdch',
            'Accept-Language' : 'en-US,en;q=0.8',
            'Cache-Control' : 'max-age=0',
            'Connection' : ' keep-alive',
            'Content-Type' : 'multipart/form-data; boundary=' + boundary.slice(2),

            'Cookie' : _.map(j.cookies, function (c) {
                return c.name + '=' + c.value
            }).join('; '),

            'Host' : 'www.odesk.com',
            'Origin' : 'https://www.odesk.com',
            'Referer' : url,

            'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.43 Safari/537.31',

            'Content-Length' : Buffer.byteLength(multipart, 'utf8')
        }
    }
    var p = _.p()
    var r = https.request(options, function (res) {
        if (res.statusCode >= 400) p(new Error('error, status code = ' + res.statusCode))
        p(res)
    })
    r.write(multipart)
    r.end()
    _.consume(_.p())
}

var cats = {
    "Web Development": {
        "Web Design": 8,
        "Web Programming": 9,
        "Ecommerce": 11,
        "UI Design": 13,
        "Website QA": 15,
        "Website Project Management": 16,
        "Other - Web Development": 17
    },
    "Software Development": {
        "Desktop Applications": 18,
        "Game Development": 20,
        "Scripts & Utilities": 21,
        "Software Plug-ins": 22,
        "Mobile Apps": 23,
        "Application Interface Design": 24,
        "Software Project Management": 25,
        "Software QA": 26,
        "VOIP": 27,
        "Other - Software Development": 28
    },
    "Networking & Information Systems": {
        "Network Administration": 29,
        "DBA - Database Administration": 31,
        "Server Administration": 32,
        "Other - Networking & Information Systems": 33,
        "ERP / CRM Implementation": 59
    },
    "Writing & Translation": {
        "Technical Writing": 34,
        "Website Content": 35,
        "Blog & Article Writing": 37,
        "Copywriting": 38,
        "Other - Writing & Translation": 39,
        "Translation": 58,
        "Creative Writing": 62
    },
    "Administrative Support": {
        "Data Entry": 40,
        "Personal Assistant": 41,
        "Web Research": 42,
        "Email Response Handling": 43,
        "Other - Administrative Support": 46,
        "Transcription": 63
    },
    "Design & Multimedia": {
        "Graphic Design": 47,
        "Logo Design": 48,
        "Illustration": 49,
        "Print Design": 50,
        "3D Modeling & CAD": 51,
        "Audio Production": 53,
        "Video Production": 54,
        "Voice Talent": 55,
        "Animation": 56,
        "Other - Design & Multimedia": 57,
        "Presentations": 60,
        "Engineering & Technical Design": 61
    },
    "Customer Service": {
        "Customer Service & Support": 64,
        "Technical Support": 65,
        "Phone Support": 66,
        "Other - Customer Service": 67,
        "Order Processing": 87
    },
    "Sales & Marketing": {
        "Advertising": 68,
        "Email Marketing": 69,
        "SEM - Search Engine Marketing": 70,
        "SMM - Social Media Marketing": 71,
        "PR - Public Relations": 72,
        "Telemarketing & Telesales": 73,
        "Market Research & Surveys": 74,
        "Sales & Lead Generation": 75,
        "Other - Sales & Marketing": 76,
        "SEO - Search Engine Optimization": 88,
        "Business Plans & Marketing Strategy": 89
    },
    "Business Services": {
        "Accounting": 77,
        "HR / Payroll": 78,
        "Financial Services & Planning": 79,
        "Payment Processing": 80,
        "Legal": 81,
        "Project Management": 82,
        "Business Consulting": 83,
        "Recruiting": 84,
        "Statistical Analysis": 85,
        "Other - Business Services": 86,
        "Bookkeeping": 90
    }
}
