/*
File: GroupInfo.jsx
Purpose: Modal component for displaying group information, member list, and invitation link generation
Date Created: 2026-02-24
Initial Author(s): Garrett Caldwell

System Context: Renders as an overlay modal displaying group details (name, members) 
and providing functionality to generate shareable invite links for adding new members 
to the group. Integrates with the groups API for fetching member 
lists and creating invite tokens.

*/

// React imports - useState for UI state (members, loading, invite link, copy feedback), useEffect for async data loading
import React, { useState, useEffect } from 'react';

// API utilities - apiGet and apiPost for backend group and invite token requests
import { apiGet, apiPost } from '../../api.js';
import { useModalAccessibility } from '../common/useModalAccessibility.js';

// CSS - groupsModal.css provides standard modal styling (overlay, content container, buttons, form inputs)
import '../../css/groupsModal.css'; 

/** 
 * Reusable modal for displaying group information, members, and invitation management.
 * Fetches group details on mount and provides copy-to-clipboard functionality for shareable invite links.
 *
 * @param {number} groupId - Numeric group identifier for API requests
 * @param {string} groupName - Display name of the group for the modal title
 * @param {function} onClose - Callback function triggered when user clicks the Close button
 * @returns {JSX.Element} Modal overlay containing group info and invite section
*/
export default function GroupInfoModal({ groupId, groupName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle");
    const { dialogRef, titleId, descriptionId } = useModalAccessibility({
        isOpen: true,
        onClose
    });
    

    // Load group member list and generate invite link when component mounts or groupId changes
    useEffect(() => {
        const loadGroupDetails = async () => {
            setLoading(true);
            try {
                const response = await apiGet(`/group/${groupId}`);
                if (response && response.success) {
                    setMembers(response.members);
                }
                await makeInviteLink()
            } catch (error) {
                console.error("Error loading group details:", error);
            } finally {
                setLoading(false);
            }
        };

        if (groupId) {
            loadGroupDetails();
        }
    }, [groupId]);

    // Auto-reset copy status feedback after 2 seconds (allows cutoff if user closes modal)
    useEffect(() => {
        let timeoutId;
        if (copyStatus === 'success' || copyStatus === 'error') {
            timeoutId = setTimeout(() => {
                setCopyStatus('idle');
            }, 2000); // Reset status after 2 seconds -- also allows for cutoff if close modal
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [copyStatus]);

    // Copy invite link to clipboard; update UI to show success/error feedback
    const handleCopyClick = async () => {
        if (!inviteLink) {
            setCopyStatus("error");
            return;
        }

        setCopyStatus("copying");
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopyStatus("success");
        } catch (err) {
            console.error("Failed to copy!", err);
            setCopyStatus("error");
        }
    };

    // Generate a new invite link by requesting a token from the backend; prepend domain to form full URL
    const makeInviteLink = async () => {
        setCopyStatus("idle");
        const inviteResponse = await apiPost("/api/group/invite", {
            group_id: groupId
        });

        if (inviteResponse.invite) {
            const rawInvite = String(inviteResponse.invite).trim();
            const normalizedInvite = /^https?:\/\//i.test(rawInvite) ? rawInvite : `https://${rawInvite}`;
            setInviteLink(normalizedInvite);
        } 

    }


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                ref={dialogRef}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
            >
                {/* Fallback to 'Group' if name isn't passed */}
                <h2 className="modal-title" id={titleId}>{groupName || 'Group'} Info</h2>
                <p id={descriptionId} className="modal-description">
                    Review group members and copy an invitation link.
                </p>
                
                <h3 className="modal-label members-title">Members</h3>
                {loading ? (
                    <p className="modal-description">Loading members...</p>
                ) : (
                    <ul className="member-list">
                        {members.length > 0 ? (
                            members.map((member) => (
                                <li key={member.user_id} className="member-list-item">
                                    {member.username}
                                </li>
                            ))
                        ) : (
                            <li className="member-list-empty">No members found.</li>
                        )}
                    </ul>
                )}
                <h3 className="modal-label members-title">Invite new members</h3>
                <div className="invite-link-container">
                        <input
                            type="text"
                            value={inviteLink}
                            readOnly
                            className="invite-link-input"
                        />
                        <button
                            className="secondary-btn invite-copy-btn"
                            onClick={handleCopyClick}
                            disabled={!inviteLink || copyStatus === 'copying'}
                        >
                            {copyStatus === 'success' ? 'Copied!' : 
                            copyStatus === 'error' ? 'Error' : 'Copy'}
                        </button>
                </div>

                <div className="modal-actions">
                    <button className="primary-btn" onClick={onClose} aria-label="Close group info modal">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}