// React-compatible JSX version of the event post modal
import React, { useState } from 'react';
import '../PostModal.css'; // you can extract styles from the original HTML

export default function PostModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="open-post-modal-btn">Post Your Event</button>
      {isOpen && (
        <div className="modal-overlay" id="postModal">
          <div className="modal-content">
            <h2>Post Your Event</h2>
            {/* Add your form inputs, upload area, and venue dropdown here */}
            <button onClick={() => setIsOpen(false)} className="close-modal">×</button>
          </div>
        </div>
      )}
    </>
  );
}
