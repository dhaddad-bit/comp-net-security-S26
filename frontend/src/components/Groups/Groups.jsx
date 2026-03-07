import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api.js';
import GroupCreatorModal from './GroupCreator.jsx';
import GroupInfoModal from './GroupInfo.jsx';
import '../../css/groups.css';
import '../../css/groupsModal.css';

export default function Groups({ selectedGroupId, onSelectGroup, onOpenPetition, refreshSignal = 0 }) {
    const [groups, setGroups] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [infoModalGroup, setInfoModalGroup] = useState(null);

    // Function to fetch groups (replaces the initial apiGet)
    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await apiGet('/user/groups');
            if (response && response.groups) {
                setGroups(response.groups);
            } else {
                setGroups([]);
            }
        } catch (error) {
            console.error("Failed to fetch groups", error);
            setGroups([]);
        } finally {
            setLoading(false);
        }
    };

    // Load groups when component mounts and when parent asks for a refresh.
    useEffect(() => {
        fetchGroups();
    }, [refreshSignal]);

    const handleLeaveGroup = async (groupId) => {
        console.log("leaving group", groupId);
        try {
            await apiPost('/group/leave', { groupId: groupId });
            // Refresh list after leaving
            fetchGroups();
            if (Number(selectedGroupId) === Number(groupId)) {
                onSelectGroup(null);
                // Deselect group if it was the active one
            }
        } catch (error) {
            console.error("Failed to leave group", error);
        }
    };

    const handleCreateSuccess = () => {
        // Refresh immediately after create success; modal remains open for invite sharing.
        fetchGroups();
    };

    const handleModalDone = () => {
        setShowModal(false);
    };

    return (
        // ID "groups" is crucial for matching css/groups.css selectors
        <section id="groups">
            <h2>My Groups</h2>

            <button type="button" className="groups-create-btn" onClick={() => setShowModal(true)}>
                + Create New Group
            </button>

            {loading ? <p>Loading...</p> : null}

            {groups.map((group) => {
                const isActive = Number(selectedGroupId) === Number(group.group_id);
                return (
                <div key={group.group_id} className="group-row">
                    <span className="group-row-name">{group.group_name}</span>
                    
                    <div className="group-actions">
                        <button 
                            type="button"
                            id="infoBtn" 
                            className="group-action-btn"
                            onClick={() => {
                                setInfoModalGroup(group);
                            }}
                        >
                            Info
                        </button>

                        <button 
                            type="button"
                            id="viewBtn" 
                            className={`group-action-btn ${isActive ? 'active-view-btn' : ''}`}
                            style={{background: isActive ? '#26aa5d' : '#2ecc71'}}
                            onClick={() => {
                                if (isActive) {
                                    onSelectGroup(null);
                                } else {
                                    onSelectGroup(group.group_id);
                                }
                            }}
                        >
                            {isActive ? 'Hide' : 'View'}
                        </button>

                        <button 
                            type="button"
                            id="petitionBtn" 
                            className="group-action-btn"
                            onClick={() => {
                                console.log("Create petition for group", group.group_id);
                                onOpenPetition(group.group_id);
                            }}
                        >
                            Petition
                        </button>

                        <button 
                            type="button"
                            id="leaveBtn" 
                            className="group-action-btn"
                            onClick={() => handleLeaveGroup(group.group_id)}
                        >
                            Leave
                        </button>
                    </div>
                </div>
            );
            })}

            {/* Conditionally render the modal */}
            {showModal && (
                <GroupCreatorModal 
                    onClose={() => setShowModal(false)} 
                    onGroupCreated={handleCreateSuccess}
                    onDone={handleModalDone}
                />
            )}

            {infoModalGroup && (
                <GroupInfoModal
                    groupId={infoModalGroup.group_id}
                    groupName={infoModalGroup.group_name}
                    onClose={() => setInfoModalGroup(null)}
                />
            )}
        </section>
    );
}
