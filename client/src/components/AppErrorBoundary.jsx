import { Component } from 'react';
import { notifyError } from '../utils/notifications';

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    notifyError(error, 'The application encountered an unexpected error');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800" role="alert">
          The page could not be displayed because an unexpected error occurred. Refresh the page to try again.
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
