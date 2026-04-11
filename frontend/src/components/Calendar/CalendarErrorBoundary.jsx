import React from 'react';

class CalendarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Calendar render failure:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="calendar-error-fallback" role="alert">
          <h3>Calendar temporarily unavailable</h3>
          <p>Refreshing the page usually resolves transient data errors.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CalendarErrorBoundary;
