      // Check for file system handles in modern browsers
      let jsonHandle = null;
      if (e.dataTransfer.items) {
        for (const item of e.dataTransfer.items) {
          if (item.kind === 'file' && typeof item.getAsFileSystemHandle === 'function') {
            try {
              const handle = await item.getAsFileSystemHandle();
              if (handle && handle.name.toLowerCase().endsWith('.json')) {
                jsonHandle = handle;
              }
            } catch (err) {}
          }
        }
      }
