/*
File: emailer.js
Purpose: Sends backend invitation emails through Resend.
    This module stays small because the invite routes handle the flow around it.
Date Created: 2026-02-07
Initial Author(s): Stella Greenvoss

System Context:
Sends emails based on backend requests.
*/

const {Resend} = require('resend');

// Lazy-init so a missing RESEND_API_KEY does not crash server boot. The
// client is only constructed on the first real send attempt.
let resendClient = null;
function getResend() {
    if (resendClient) return resendClient;
    if (!process.env.RESEND_API_KEY) return null;
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
}

function groupRequest(user_email, from_username, shareable_link)  {
    const client = getResend();
    if (!client) {
        console.warn('[emailer] RESEND_API_KEY not set — skipping invite email to', user_email);
        return;
    }
    // Send the share link email using the sender's username in the subject line.
    client.emails.send({
        from: 'hello@socialscheduler.me',
        to: user_email,
        subject: `Want to join ${from_username}'s group?`,
        html: `<p>Click this link to start meeting with people in ${from_username}'s group on Social Scheduler!</p><a href="https://${shareable_link}">Link here</a></p>`
    });
}

module.exports = {
    groupRequest
}
